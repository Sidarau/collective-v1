import "server-only";

/**
 * Collecta — the operator assistant behind the orb.
 *
 * The client sends ids and the current route only (`CollectaContext`); this
 * module re-fetches every referenced record server-side and never trusts
 * client-supplied content. The route tells Collecta what the operator is
 * looking at — "it", "this", "that" resolve against that record.
 *
 * Material changes return as drafts — approval, money, access and publishing
 * always need an explicit confirm, and the confirm writes an audit row.
 * The rule layer owns material drafts (publish, complete, comp, settle,
 * approve, decline) — those intents are matched first and never reach the
 * model. Read intents go to Kimi with a compact pre-aggregated snapshot (no
 * raw tables; emails/note bodies/payment references stay out). If no key is
 * configured (preview deploys) or the call fails, the rule answers below are
 * the fallback — the orb never goes silent.
 *
 * Money: every amount in the schema is ALREADY minor units (cents). Never
 * multiply by 100 here — the 2026-08-02 "€1.4M instead of €14k" bug was
 * exactly that.
 */

import { getSupabaseAdmin } from "@core/supabase";
import type { OperatorPrincipal } from "@/lib/guard";
import type {
  CollectaContext,
  CollectaDraft,
  CollectaMessage,
  CollectaTurn,
} from "./contracts";
import * as live from "./live-data";
import { dayOf, formatPeriod, personName, profileName } from "./mappers";
import {
  decideAccessRequest,
  decideApplication,
  settleContribution,
} from "./record-actions";

let turnCounter = 0;
const nextTurnId = () => `live-${Date.now()}-${(turnCounter += 1)}`;

/* ------------------------------------------------------------------ *
 * Kimi — the reasoning layer behind read answers. The Selene key lives on
 * Kimi's coding endpoint (api.kimi.com/coding) and exposes the thinking
 * model `kimi-for-coding` — answers may arrive in `content` or, when the
 * token budget is tight, trail off into `reasoning_content`; we request
 * enough headroom and accept only real content.
 * ------------------------------------------------------------------ */

const KIMI_ENDPOINT = "https://api.kimi.com/coding/v1/chat/completions";
const KIMI_MODEL = "kimi-for-coding";

function kimiKey(): string | null {
  const key = process.env.KIMI_SELENE_API_KEY;
  return key && key.length > 10 ? key : null;
}

const euroOf = (minor: number) => Math.round(minor / 100).toLocaleString("en-GB");

type Core = Awaited<ReturnType<typeof live.fetchCoreData>>;

/** Name for whoever a booking belongs to — profile name, lead name, or email. */
function bookingPerson(b: Core["bookings"][number], core: Core): string {
  const joins = live.joinsFor(b, core);
  if (joins.lead) return personName(joins.lead, null);
  if (joins.user) {
    const profile = live.profileMap(core.profiles).get(joins.user.id);
    return profileName(profile, joins.user.email);
  }
  return "Unknown";
}

/** Outstanding minor units per active booking (schema amounts are already cents). */
function outstandingRows(core: Core) {
  const paid = live.paidByBooking(core.payments);
  const active = (s: string) => !["inquiry", "cancelled", "completed"].includes(s);
  return core.bookings
    .filter((b) => active(b.status))
    .map((b) => ({
      b,
      owed: Math.max(0, Math.round(b.total_price ?? 0) - (paid.get(b.id) ?? 0)),
    }))
    .filter((r) => r.owed > 0);
}

/* ------------------------------------------------------------------ *
 * Page focus — what the operator is looking at, resolved server-side.
 * ------------------------------------------------------------------ */

type Focus = {
  /** One human line for the snapshot: "Contribution outstanding — Alex Sidarau · 8–16 Jul · €2,240". */
  line: string;
  /** Machine handles the intents below resolve against. */
  due?: { bookingId: string; person: string; outstandingMinor: number; period: string };
  accessRequest?: { bookingId: string; person: string; status: string; period: string };
  application?: { applicationId: string; person: string; status: string };
};

function resolveFocus(context: CollectaContext, core: Core): Focus | null {
  const route = context.route ?? "";
  const villas = live.villaMap(core.villas);

  const dueMatch = /^\/dues\/tx-due-([^/?]+)/.exec(route);
  if (dueMatch) {
    const booking = core.bookings.find((b) => b.id === dueMatch[1]);
    if (!booking) return null;
    const row = outstandingRows(core).find((r) => r.b.id === booking.id);
    const person = bookingPerson(booking, core);
    const period = formatPeriod(booking.check_in, booking.check_out);
    const owed = row?.owed ?? 0;
    return {
      line: owed
        ? `Contribution outstanding — ${person} · ${period} · €${euroOf(owed)}`
        : `Contribution settled — ${person} · ${period}`,
      due: owed ? { bookingId: booking.id, person, outstandingMinor: owed, period } : undefined,
    };
  }

  const paymentMatch = /^\/dues\/tx-([^/?]+)/.exec(route);
  if (paymentMatch) {
    const payment = core.payments.find((p) => p.id === paymentMatch[1]);
    if (!payment) return null;
    const booking = live.bookingMap(core.bookings).get(payment.booking_id);
    const person = booking ? bookingPerson(booking, core) : null;
    return {
      line: `Payment recorded — ${[person, booking ? formatPeriod(booking.check_in, booking.check_out) : null].filter(Boolean).join(" · ")} · €${euroOf(Math.round(payment.amount ?? 0))}`,
    };
  }

  const reqBkMatch = /^\/requests\/req-bk-([^/?]+)/.exec(route);
  if (reqBkMatch) {
    const booking = core.bookings.find((b) => b.id === reqBkMatch[1]);
    if (!booking) return null;
    const person = bookingPerson(booking, core);
    const period = formatPeriod(booking.check_in, booking.check_out);
    const villa = villas.get(booking.villa_id)?.name ?? "?";
    return {
      line: `Access request — ${person} · ${villa} · ${period} · ${booking.guests} guests · status ${booking.status}`,
      accessRequest: { bookingId: booking.id, person, status: booking.status, period },
    };
  }

  const reqAppMatch = /^\/requests\/req-app-([^/?]+)/.exec(route);
  if (reqAppMatch) {
    const app = core.applications.find((a) => a.id === reqAppMatch[1]);
    if (!app) return null;
    const name = `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || app.email;
    return {
      line: `Application — ${name} · status ${app.status}${app.preferred_window ? ` · ${app.preferred_window}` : ""}`,
      application: { applicationId: app.id, person: name, status: app.status },
    };
  }

  const reqFuMatch = /^\/requests\/req-fu-([^/?]+)/.exec(route);
  if (reqFuMatch) {
    const fu = core.followUps.find((f) => f.id === reqFuMatch[1]);
    if (!fu) return null;
    return { line: `Follow-up — ${fu.title} · status ${fu.status}` };
  }

  const personMatch = /^\/people\/person-([^/?]+)/.exec(route);
  if (personMatch) {
    const user = core.users.find((u) => u.id === personMatch[1]);
    if (!user) return null;
    const profile = live.profileMap(core.profiles).get(user.id);
    const name = profileName(profile, user.email);
    const app = core.applications.find(
      (a) => a.email.toLowerCase() === user.email.toLowerCase() && a.status === "submitted",
    );
    return {
      line: `Person — ${name} · role ${user.role}${app ? ` · application ${app.status}` : ""}`,
      application: app ? { applicationId: app.id, person: name, status: app.status } : undefined,
    };
  }

  const spaceMatch = /^\/spaces\/space-([^/?]+)/.exec(route);
  if (spaceMatch) {
    const villa = core.villas.find((v) => v.id === spaceMatch[1]);
    if (!villa) return null;
    const areas = core.rooms.filter((r) => r.villa_id === villa.id).length;
    return { line: `Space — ${villa.name} · ${areas} areas` };
  }

  const expMatch = /^\/experiences\/exp-([^/?]+)/.exec(route);
  if (expMatch) {
    const event = core.events.find((e) => e.id === expMatch[1]);
    if (!event) return null;
    const villa = event.villa_id ? villas.get(event.villa_id)?.name : "Network";
    return { line: `Experience — ${event.title} · ${dayOf(event.start_at)} · ${villa} · status ${event.status}` };
  }

  return null;
}

/**
 * The model sees a compact, pre-aggregated snapshot — never raw tables, and
 * nothing the operator couldn't read themselves. Emails, notes bodies and
 * payment references stay out of the prompt. All money is quoted in euros.
 */
function buildSnapshot(core: Core, now: string, focus: Focus | null): string {
  const today = dayOf(now);
  const active = (s: string) => !["inquiry", "cancelled", "completed"].includes(s);
  const arrivals = core.bookings.filter((b) => dayOf(b.check_in) === today && active(b.status)).length;
  const departures = core.bookings.filter((b) => dayOf(b.check_out) === today && active(b.status)).length;
  const openRequests = core.bookings.filter((b) => b.status === "requested");
  const newApplications = core.applications.filter((a) => a.status === "submitted").length;
  const owed = outstandingRows(core);
  const outstandingTotal = owed.reduce((n, r) => n + r.owed, 0);
  const openFollowUps = core.followUps.filter((f) => f.status === "open");
  const draftEvents = core.events.filter((e) => e.status === "draft");
  const upcoming = core.events
    .filter((e) => e.status === "published" && e.start_at >= now)
    .sort((a, b) => (a.start_at < b.start_at ? -1 : 1))
    .slice(0, 8);
  const villas = live.villaMap(core.villas);
  const profiles = new Map(core.profiles.map((p) => [p.user_id, p]));
  const userName = (id: string | null) => {
    if (!id) return null;
    const user = core.users.find((u) => u.id === id);
    if (!user) return null;
    const profile = profiles.get(id);
    const full = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";
    return full || user.email.split("@")[0];
  };

  const lines: string[] = [
    `Today: ${today}. Arrivals ${arrivals}, departures ${departures}.`,
    focus ? `Operator is looking at: ${focus.line}` : null,
    `Open access requests (${openRequests.length}): ${openRequests
      .slice(0, 8)
      .map((b) => `${userName(b.user_id) ?? bookingPerson(b, core)} · ${villas.get(b.villa_id)?.name ?? "?"} · ${b.check_in}→${b.check_out} · ${b.guests} guests`)
      .join(" | ") || "none"}`,
    `New applications: ${newApplications}.`,
    `Outstanding: €${euroOf(outstandingTotal)} across ${owed.length} stays.`,
    ...(owed.length
      ? owed.slice(0, 6).map(
          (r) => `  · ${bookingPerson(r.b, core)} · ${villas.get(r.b.villa_id)?.name ?? "?"} · ${r.b.check_in}→${r.b.check_out} · €${euroOf(r.owed)}`,
        )
      : []),
    `Open follow-ups (${openFollowUps.length}): ${openFollowUps.slice(0, 8).map((f) => f.title).join(" | ") || "none"}`,
    `Draft experiences (${draftEvents.length}): ${draftEvents.map((e) => e.title).join(" | ") || "none"}`,
    `Upcoming published: ${upcoming.map((e) => `${e.title} · ${dayOf(e.start_at)} · ${villas.get(e.villa_id ?? "")?.name ?? "Network"}`).join(" | ") || "none"}`,
    `Spaces: ${core.villas.map((v) => `${v.name} (${core.rooms.filter((r) => r.villa_id === v.id).length} areas)`).join(" | ")}`,
    `People on record: ${core.users.length} users, ${core.leads.length} leads, ${core.staff.length} partners.`,
  ].filter((l): l is string => Boolean(l));
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Collecta, the operator assistant of a private members' collective.

Ground rules:
- Answer from the live snapshot provided — never invent records, amounts or dates.
- Every amount in the snapshot is already in euros. Quote amounts exactly as written; never rescale them (no "million" unless the snapshot literally says million).
- The line "Operator is looking at:" names the record on the operator's screen. Pronouns like "it", "this", "that", "him", "her" refer to that record — answer about it directly.
- Style: short, plain, warm. Lead with the answer. Euros as €X, no cents unless they matter.
- If the snapshot cannot answer, say what you can see instead of guessing.

What you can DO — always as a draft the operator confirms before anything changes:
- Comp (waive) an outstanding contribution: "comp it", "comp Alex's July stay".
- Record a contribution as received: "record it as received", "mark it paid".
- Approve or decline an access request: "approve it", "decline that one".
- Approve or deny an application: "approve her", "deny this one".
- Publish a draft experience: "publish the dinner".
- Mark a follow-up done: "close the follow-up".
Anything else (sending messages, moving real money, editing records) is a console job — say so in one line.
When the operator asks for one of these, confirm what you'll draft — the app shows the confirm sheet itself.`;

async function askKimi(snapshot: string, prompt: string): Promise<string | null> {
  const key = kimiKey();
  if (!key) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(KIMI_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: KIMI_MODEL,
        temperature: 1, // the thinking model rejects anything else
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Live snapshot:\n${snapshot}\n\nOperator asks: ${prompt}` },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[collecta] kimi ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (e) {
    console.error("[collecta] kimi call failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const msg = (turn: string, role: "operator" | "collecta", body: string, at: string): CollectaMessage => ({
  id: `${turn}-${role}`,
  role,
  body,
  at,
});

/**
 * Every draft the sheet can show. `action` is the machine half the UI never
 * sees: it round-trips through the confirm server action, which re-validates
 * and executes. `kind` is the audit verb.
 */
export interface DraftAction {
  kind:
    | "publish_event"
    | "complete_follow_up"
    | "comp_due"
    | "record_payment"
    | "decide_request"
    | "decide_application";
  eventId?: string;
  followUpId?: string;
  bookingId?: string;
  applicationId?: string;
  decision?: "approve" | "decline" | "deny";
}

const DRAFT_KINDS = new Set<DraftAction["kind"]>([
  "publish_event",
  "complete_follow_up",
  "comp_due",
  "record_payment",
  "decide_request",
  "decide_application",
]);

export function encodeDraftAction(action: DraftAction): string {
  return Buffer.from(JSON.stringify(action), "utf8").toString("base64url");
}

export function decodeDraftAction(encoded: string): DraftAction | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (parsed && DRAFT_KINDS.has(parsed.kind)) {
      return parsed as DraftAction;
    }
    return null;
  } catch {
    return null;
  }
}

export async function answerCollecta(
  context: CollectaContext,
  prompt: string,
  principal: OperatorPrincipal,
): Promise<CollectaTurn> {
  void principal; // the guard authorizes; answers are operator-scoped reads
  const now = new Date().toISOString();
  const turn = nextTurnId();
  const operator = msg(turn, "operator", prompt, now);

  try {
    const core = await live.fetchCoreData();
    const text = prompt.toLowerCase();
    const focus = resolveFocus(context, core);

    // --- Material intents → drafts (matched first, never reach the model) --

    if (/\bpublish\b/.test(text)) {
      const drafts = core.events.filter((e) => e.status === "draft");
      const match =
        drafts.find((e) => text.includes(e.title.toLowerCase())) ??
        (context.selectedEventId?.startsWith("ev-exp-")
          ? drafts.find((e) => `exp-${e.id}` === context.selectedEventId!.replace("ev-exp-", "exp-"))
          : null) ??
        (drafts.length === 1 ? drafts[0] : null);

      if (match) {
        const space = match.villa_id ? live.villaMap(core.villas).get(match.villa_id)?.name : null;
        const draft: CollectaDraft = {
          id: encodeDraftAction({ kind: "publish_event", eventId: match.id }),
          title: `Publish ${match.title}?`,
          detail: `${dayOf(match.start_at)}${space ? ` · ${space}` : ""}`,
          facts: [
            { label: "Experience", value: match.title },
            { label: "Space", value: space ?? "Network" },
            { label: "Capacity", value: match.capacity ? `${match.capacity} people` : "Open" },
            { label: "Current state", value: "Draft" },
          ],
          confirmLabel: "Publish",
          requiresConfirmation: true,
        };
        return {
          state: "draft",
          messages: [operator, msg(turn, "collecta", `I can publish ${match.title}. Review the details before I do.`, now)],
          draft,
        };
      }
      return {
        state: "answer",
        messages: [operator, msg(turn, "collecta", drafts.length ? "Which experience should I publish? Name it and I'll draft it." : "There are no draft experiences to publish.", now)],
      };
    }

    if (/\b(done|complete|close)\b/.test(text) && /follow.?up|task/.test(text)) {
      const open = core.followUps.filter((f) => f.status === "open");
      const match = open.find((f) => text.includes(f.title.toLowerCase().slice(0, 12))) ?? (open.length === 1 ? open[0] : null);
      if (match) {
        const draft: CollectaDraft = {
          id: encodeDraftAction({ kind: "complete_follow_up", followUpId: match.id }),
          title: `Mark done: ${match.title}?`,
          detail: match.due_at ? `Due ${dayOf(match.due_at)}` : "No due date",
          facts: [
            { label: "Follow-up", value: match.title },
            { label: "State", value: "Open → done" },
          ],
          confirmLabel: "Mark done",
          requiresConfirmation: true,
        };
        return {
          state: "draft",
          messages: [operator, msg(turn, "collecta", "I'll mark it done once you confirm.", now)],
          draft,
        };
      }
      return {
        state: "answer",
        messages: [operator, msg(turn, "collecta", open.length ? "Which follow-up? Say its name." : "No open follow-ups.", now)],
      };
    }

    // Comp — waive an outstanding contribution. Focus first, then a named
    // person, then the only outstanding stay.
    if (/\bcomp(ed)?\b/.test(text)) {
      const owed = outstandingRows(core);
      const byName = owed.find((r) => {
        const name = bookingPerson(r.b, core).toLowerCase();
        return name !== "unknown" && name.split(" ").some((part) => part.length > 2 && text.includes(part));
      });
      const target = focus?.due
        ? { bookingId: focus.due.bookingId, person: focus.due.person, owedMinor: focus.due.outstandingMinor, period: focus.due.period }
        : byName
          ? { bookingId: byName.b.id, person: bookingPerson(byName.b, core), owedMinor: byName.owed, period: formatPeriod(byName.b.check_in, byName.b.check_out) }
          : owed.length === 1
            ? { bookingId: owed[0].b.id, person: bookingPerson(owed[0].b, core), owedMinor: owed[0].owed, period: formatPeriod(owed[0].b.check_in, owed[0].b.check_out) }
            : null;

      if (target) {
        const draft: CollectaDraft = {
          id: encodeDraftAction({ kind: "comp_due", bookingId: target.bookingId }),
          title: `Comp ${target.person} · €${euroOf(target.owedMinor)}?`,
          detail: `${target.period} · the stay reads settled, no money moves`,
          facts: [
            { label: "Person", value: target.person },
            { label: "Period", value: target.period },
            { label: "Amount", value: `€${euroOf(target.owedMinor)}` },
            { label: "Effect", value: "Outstanding → comped" },
          ],
          confirmLabel: "Comp it",
          requiresConfirmation: true,
        };
        return {
          state: "draft",
          messages: [operator, msg(turn, "collecta", `I can comp ${target.person}'s €${euroOf(target.owedMinor)} for ${target.period}. Review before I do.`, now)],
          draft,
        };
      }
      return {
        state: "answer",
        messages: [operator, msg(turn, "collecta", owed.length ? "Which stay should I comp? Open it or name the person." : "Nothing is outstanding — nothing to comp.", now)],
      };
    }

    // Record as received — money actually arrived.
    if (/\b(record|received|mark(ed)? (as )?(paid|received)|settle)\b/.test(text)) {
      const target = focus?.due ?? null;
      if (target) {
        const draft: CollectaDraft = {
          id: encodeDraftAction({ kind: "record_payment", bookingId: target.bookingId }),
          title: `Record €${euroOf(target.outstandingMinor)} received from ${target.person}?`,
          detail: target.period,
          facts: [
            { label: "Person", value: target.person },
            { label: "Period", value: target.period },
            { label: "Amount", value: `€${euroOf(target.outstandingMinor)}` },
          ],
          confirmLabel: "Record",
          requiresConfirmation: true,
        };
        return {
          state: "draft",
          messages: [operator, msg(turn, "collecta", `I'll record the full €${euroOf(target.outstandingMinor)} as received once you confirm.`, now)],
          draft,
        };
      }
    }

    // Approve / decline — the focused access request or application first,
    // then a named open request.
    const wantsApprove = /\bapprov/.test(text);
    const wantsDecline = /\b(declin|deny|denie|reject)/.test(text);
    if (wantsApprove || wantsDecline) {
      if (focus?.accessRequest && ["requested", "inquiry"].includes(focus.accessRequest.status)) {
        const decision = wantsApprove ? "approve" : "decline";
        const r = focus.accessRequest;
        const draft: CollectaDraft = {
          id: encodeDraftAction({ kind: "decide_request", bookingId: r.bookingId, decision }),
          title: `${wantsApprove ? "Approve" : "Decline"} ${r.person} · ${r.period}?`,
          detail: wantsApprove ? "The area is conflict-checked before it commits" : "The request is released",
          facts: [
            { label: "Person", value: r.person },
            { label: "Period", value: r.period },
            { label: "Current state", value: r.status },
          ],
          confirmLabel: wantsApprove ? "Approve" : "Decline",
          requiresConfirmation: true,
        };
        return {
          state: "draft",
          messages: [operator, msg(turn, "collecta", `Review it — nothing changes until you confirm.`, now)],
          draft,
        };
      }
      if (focus?.application && ["submitted", "screening"].includes(focus.application.status)) {
        const a = focus.application;
        const draft: CollectaDraft = {
          id: encodeDraftAction({ kind: "decide_application", applicationId: a.applicationId, decision: wantsApprove ? "approve" : "deny" }),
          title: `${wantsApprove ? "Approve" : "Deny"} ${a.person}?`,
          detail: wantsApprove ? "Member access + their entrance link" : "The application is declined",
          facts: [
            { label: "Person", value: a.person },
            { label: "Current state", value: a.status },
          ],
          confirmLabel: wantsApprove ? "Approve" : "Deny",
          requiresConfirmation: true,
        };
        return {
          state: "draft",
          messages: [operator, msg(turn, "collecta", `Review it — nothing changes until you confirm.`, now)],
          draft,
        };
      }
      // A named open access request.
      const openReqs = core.bookings.filter((b) => b.status === "requested");
      const named = openReqs.find((b) => {
        const name = bookingPerson(b, core).toLowerCase();
        return name !== "unknown" && name.split(" ").some((part) => part.length > 2 && text.includes(part));
      });
      if (named) {
        const person = bookingPerson(named, core);
        const period = formatPeriod(named.check_in, named.check_out);
        const draft: CollectaDraft = {
          id: encodeDraftAction({ kind: "decide_request", bookingId: named.id, decision: wantsApprove ? "approve" : "decline" }),
          title: `${wantsApprove ? "Approve" : "Decline"} ${person} · ${period}?`,
          detail: wantsApprove ? "The area is conflict-checked before it commits" : "The request is released",
          facts: [
            { label: "Person", value: person },
            { label: "Period", value: period },
          ],
          confirmLabel: wantsApprove ? "Approve" : "Decline",
          requiresConfirmation: true,
        };
        return {
          state: "draft",
          messages: [operator, msg(turn, "collecta", `Review it — nothing changes until you confirm.`, now)],
          draft,
        };
      }
      return {
        state: "answer",
        messages: [operator, msg(turn, "collecta", "Which one? Open the request or application, or name the person.", now)],
      };
    }

    // --- Read intents → Kimi first, rules as fallback --------------------

    const snapshot = buildSnapshot(core, now, focus);
    const llmAnswer = await askKimi(snapshot, prompt);
    if (llmAnswer) {
      return { state: "answer", messages: [operator, msg(turn, "collecta", llmAnswer, now)] };
    }

    // --- Read intents → rule answers (no key configured, or call failed) --

    if (/selected|this item|this one|this page|looking at/.test(text) && focus) {
      return { state: "answer", messages: [operator, msg(turn, "collecta", focus.line, now)] };
    }

    if (/summary|today|what.*(need|decision)|briefing/.test(text)) {
      const today = dayOf(now);
      const active = (s: string) => !["inquiry", "cancelled", "completed"].includes(s);
      const arrivals = core.bookings.filter((b) => dayOf(b.check_in) === today && active(b.status)).length;
      const departures = core.bookings.filter((b) => dayOf(b.check_out) === today && active(b.status)).length;
      const openRequests = core.bookings.filter((b) => b.status === "requested").length;
      const newApplications = core.applications.filter((a) => a.status === "submitted").length;
      const outstanding = outstandingRows(core).reduce((n, r) => n + r.owed, 0);
      const parts = [
        arrivals || departures ? `${arrivals} arrivals, ${departures} departures today` : "No movement today",
        openRequests ? `${openRequests} access ${openRequests === 1 ? "request" : "requests"} waiting` : null,
        newApplications ? `${newApplications} new ${newApplications === 1 ? "application" : "applications"}` : null,
        outstanding ? `€${euroOf(outstanding)} outstanding` : null,
      ].filter(Boolean);
      return { state: "answer", messages: [operator, msg(turn, "collecta", parts.join(" · ") + ".", now)] };
    }

    if (/outstanding|owed|unpaid|due\b/.test(text)) {
      const owed = outstandingRows(core);
      if (!owed.length) {
        return { state: "answer", messages: [operator, msg(turn, "collecta", "Nothing is outstanding.", now)] };
      }
      const top = owed.slice(0, 3).map((r) => `${bookingPerson(r.b, core)}: €${euroOf(r.owed)}`).join(" · ");
      return { state: "answer", messages: [operator, msg(turn, "collecta", `${owed.length} outstanding. ${top}.`, now)] };
    }

    // Fallback — honest about scope.
    return {
      state: "answer",
      messages: [
        operator,
        msg(turn, "collecta", "I can brief you on today, list what is outstanding, and draft comps, approvals, publishes or follow-up completions for your confirmation. Open a record and say \"comp it\" or \"approve it\" — I'll know which one you mean.", now),
      ],
    };
  } catch (e) {
    console.error("[collecta] answer failed:", e instanceof Error ? e.message : e);
    return {
      state: "answer",
      messages: [operator, msg(turn, "collecta", "I could not reach the records just now. Try again in a moment.", now)],
    };
  }
}

/**
 * Executes a confirmed draft. Re-validates everything server-side (the draft
 * payload is client-round-tripped and therefore untrusted), applies the
 * change, and writes the audit row. Returns the operator-facing line.
 */
export async function confirmDraft(
  encoded: string,
  principal: OperatorPrincipal,
): Promise<{ ok: boolean; message: string }> {
  const action = decodeDraftAction(encoded);
  if (!action) return { ok: false, message: "That draft is no longer valid." };

  const db = getSupabaseAdmin();

  if (action.kind === "publish_event" && action.eventId) {
    const { data: event } = await db.from("events").select("id, title, status").eq("id", action.eventId).maybeSingle();
    if (!event) return { ok: false, message: "That experience no longer exists." };
    if (event.status === "published") return { ok: true, message: `${event.title} is already published.` };
    if (event.status !== "draft") return { ok: false, message: `${event.title} cannot be published from its current state.` };

    const { error } = await db.from("events").update({ status: "published" }).eq("id", event.id).eq("status", "draft");
    if (error) return { ok: false, message: "The publish did not go through." };

    await db.from("audit_logs").insert({
      actor_id: principal.id,
      actor_email: principal.email,
      action: "event.publish",
      entity_type: "event",
      entity_id: event.id,
      summary: `Published ${event.title} via Collecta (mobile)`,
      meta: { surface: "mobile", assistant: "collecta" },
    });
    return { ok: true, message: `${event.title} is published. An audit entry was created.` };
  }

  if (action.kind === "complete_follow_up" && action.followUpId) {
    const { data: followUp } = await db
      .from("follow_ups")
      .select("id, title, status, entity_type, entity_id")
      .eq("id", action.followUpId)
      .maybeSingle();
    if (!followUp) return { ok: false, message: "That follow-up no longer exists." };
    const followUpRow = followUp as {
      id: string;
      title: string;
      status: string;
      entity_type: "application" | "booking" | "user" | "lead" | "villa" | "room" | "event" | "intro_request" | "staff_application" | "email" | "campaign" | "screening_call" | "referral_link" | "kb_node" | null;
      entity_id: string | null;
    };
    if (followUpRow.status !== "open") return { ok: true, message: `Already ${followUpRow.status}.` };

    const { error } = await db.from("follow_ups").update({ status: "done" }).eq("id", followUpRow.id).eq("status", "open");
    if (error) return { ok: false, message: "The update did not go through." };

    await db.from("audit_logs").insert({
      actor_id: principal.id,
      actor_email: principal.email,
      action: "follow_up.complete",
      entity_type: followUpRow.entity_type ?? "lead",
      entity_id: followUpRow.entity_id,
      summary: `Completed follow-up "${followUpRow.title}" via Collecta (mobile)`,
      meta: { surface: "mobile", assistant: "collecta", follow_up_id: followUpRow.id },
    });
    return { ok: true, message: "Marked done. An audit entry was created." };
  }

  // The decision drafts execute through the shared record-actions layer —
  // same code the detail-screen buttons call, same audit trail.
  if (action.kind === "comp_due" && action.bookingId) {
    return settleContribution({ bookingId: action.bookingId, mode: "comp" });
  }

  if (action.kind === "record_payment" && action.bookingId) {
    return settleContribution({ bookingId: action.bookingId, mode: "received" });
  }

  if (action.kind === "decide_request" && action.bookingId) {
    return decideAccessRequest({
      bookingId: action.bookingId,
      decision: action.decision === "decline" ? "decline" : "approve",
    });
  }

  if (action.kind === "decide_application" && action.applicationId) {
    return decideApplication({
      applicationId: action.applicationId,
      decision: action.decision === "deny" ? "deny" : "approve",
    });
  }

  return { ok: false, message: "That action is not supported." };
}
