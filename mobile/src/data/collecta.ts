import "server-only";

/**
 * Collecta — the operator assistant behind the orb.
 *
 * The client sends ids only (`CollectaContext`); this module re-fetches every
 * referenced record server-side and never trusts client-supplied content.
 * Material changes return as drafts — approval, money, access and publishing
 * always need an explicit confirm, and the confirm writes an audit row.
 *
 * The rule layer owns material drafts (publish, complete) — those intents are
 * matched first and never reach the model. Read intents go to Kimi with a
 * compact snapshot of live records; the model answers, it never mutates.
 * If no API key is configured (preview deploys) or the call fails, the rule
 * answers below are the fallback — the orb never goes silent.
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
import { dayOf } from "./mappers";

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

/**
 * The model sees a compact, pre-aggregated snapshot — never raw tables, and
 * nothing the operator couldn't read themselves. Emails, notes bodies and
 * payment references stay out of the prompt.
 */
function buildSnapshot(core: Awaited<ReturnType<typeof live.fetchCoreData>>, now: string): string {
  const today = dayOf(now);
  const active = (s: string) => !["inquiry", "cancelled", "completed"].includes(s);
  const arrivals = core.bookings.filter((b) => dayOf(b.check_in) === today && active(b.status)).length;
  const departures = core.bookings.filter((b) => dayOf(b.check_out) === today && active(b.status)).length;
  const openRequests = core.bookings.filter((b) => b.status === "requested");
  const newApplications = core.applications.filter((a) => a.status === "submitted").length;
  const paid = live.paidByBooking(core.payments);
  const outstandingRows = core.bookings
    .filter((b) => active(b.status))
    .map((b) => ({ b, owed: Math.max(0, Math.round((b.total_price ?? 0) * 100) - (paid.get(b.id) ?? 0)) }))
    .filter((r) => r.owed > 0);
  const outstandingTotal = outstandingRows.reduce((n, r) => n + r.owed, 0);
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
    `Open access requests (${openRequests.length}): ${openRequests
      .slice(0, 8)
      .map((b) => `${userName(b.user_id) ?? b.lead_id} · ${villas.get(b.villa_id)?.name ?? "?"} · ${b.check_in}→${b.check_out} · ${b.guests} guests`)
      .join(" | ") || "none"}`,
    `New applications: ${newApplications}.`,
    `Outstanding: €${Math.round(outstandingTotal / 100)} across ${outstandingRows.length} stays.`,
    `Open follow-ups (${openFollowUps.length}): ${openFollowUps.slice(0, 8).map((f) => f.title).join(" | ") || "none"}`,
    `Draft experiences (${draftEvents.length}): ${draftEvents.map((e) => e.title).join(" | ") || "none"}`,
    `Upcoming published: ${upcoming.map((e) => `${e.title} · ${dayOf(e.start_at)} · ${villas.get(e.villa_id ?? "")?.name ?? "Network"}`).join(" | ") || "none"}`,
    `Spaces: ${core.villas.map((v) => `${v.name} (${core.rooms.filter((r) => r.villa_id === v.id).length} areas)`).join(" | ")}`,
    `People on record: ${core.users.length} users, ${core.leads.length} leads, ${core.staff.length} partners.`,
  ];
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Collecta, the operator assistant of a private members' collective.
You answer from the live snapshot provided — never invent records, amounts or dates.
Style: short, plain, warm. Lead with the answer. Euros as €X, no cents unless they matter.
If the snapshot cannot answer, say what you can see instead of guessing.
You cannot change anything — for requests to publish, complete, approve or pay, tell the operator to ask in those words and you will draft it for their confirmation.`;

async function askKimi(snapshot: string, prompt: string, selectedLine: string | null): Promise<string | null> {
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
          { role: "user", content: `Live snapshot:\n${snapshot}${selectedLine ? `\n\nSelected item: ${selectedLine}` : ""}\n\nOperator asks: ${prompt}` },
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
  kind: "publish_event" | "complete_follow_up";
  eventId?: string;
  followUpId?: string;
}

export function encodeDraftAction(action: DraftAction): string {
  return Buffer.from(JSON.stringify(action), "utf8").toString("base64url");
}

export function decodeDraftAction(encoded: string): DraftAction | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (parsed && (parsed.kind === "publish_event" || parsed.kind === "complete_follow_up")) {
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

    // --- Material intents → drafts -------------------------------------

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

    // --- Read intents → Kimi first, rules as fallback --------------------

    const selectedEvent = context.selectedEventId
      ? live.buildTimelineEvents(core, now).find((e) => e.id === context.selectedEventId)
      : undefined;
    const selectedLine = selectedEvent
      ? [selectedEvent.title, selectedEvent.detail, selectedEvent.status.replace("_", " ")].filter(Boolean).join(" — ")
      : null;

    const llmAnswer = await askKimi(buildSnapshot(core, now), prompt, selectedLine);
    if (llmAnswer) {
      return { state: "answer", messages: [operator, msg(turn, "collecta", llmAnswer, now)] };
    }

    // --- Read intents → rule answers (no key configured, or call failed) --

    if (/selected|this item|this one/.test(text) && selectedEvent) {
      return { state: "answer", messages: [operator, msg(turn, "collecta", selectedLine!, now)] };
    }

    if (/summary|today|what.*(need|decision)|briefing/.test(text)) {
      const today = dayOf(now);
      const arrivals = core.bookings.filter((b) => dayOf(b.check_in) === today && !["inquiry", "cancelled"].includes(b.status)).length;
      const departures = core.bookings.filter((b) => dayOf(b.check_out) === today && !["inquiry", "cancelled"].includes(b.status)).length;
      const openRequests = core.bookings.filter((b) => b.status === "requested").length;
      const newApplications = core.applications.filter((a) => a.status === "submitted").length;
      const paid = live.paidByBooking(core.payments);
      const outstanding = core.bookings
        .filter((b) => !["inquiry", "cancelled"].includes(b.status))
        .reduce((n, b) => n + Math.max(0, Math.round((b.total_price ?? 0) * 100) - (paid.get(b.id) ?? 0)), 0);
      const parts = [
        arrivals || departures ? `${arrivals} arrivals, ${departures} departures today` : "No movement today",
        openRequests ? `${openRequests} access ${openRequests === 1 ? "request" : "requests"} waiting` : null,
        newApplications ? `${newApplications} new ${newApplications === 1 ? "application" : "applications"}` : null,
        outstanding ? `€${Math.round(outstanding / 100).toLocaleString("en-GB")} outstanding` : null,
      ].filter(Boolean);
      return { state: "answer", messages: [operator, msg(turn, "collecta", parts.join(" · ") + ".", now)] };
    }

    if (/outstanding|owed|unpaid|due\b/.test(text)) {
      const txs = live.buildTransactions(core).filter((t) => t.settlement === "outstanding");
      if (!txs.length) {
        return { state: "answer", messages: [operator, msg(turn, "collecta", "Nothing is outstanding.", now)] };
      }
      const top = txs.slice(0, 3).map((t) => `${t.personName ?? t.detail}: €${Math.round(t.amountMinor / 100).toLocaleString("en-GB")}`).join(" · ");
      return { state: "answer", messages: [operator, msg(turn, "collecta", `${txs.length} outstanding. ${top}.`, now)] };
    }

    // Fallback — honest about scope.
    return {
      state: "answer",
      messages: [
        operator,
        msg(turn, "collecta", "I can brief you on today, list what is outstanding, and draft publishes or follow-up completions for your confirmation.", now),
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

  return { ok: false, message: "That action is not supported." };
}
