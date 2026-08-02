import "server-only";

/**
 * Record decisions — the write path behind the detail-screen buttons and
 * Collecta's confirmed drafts.
 *
 * Every function re-checks the operator session (the guard authorizes pages;
 * these authorize writes), validates against the live row, writes, and leaves
 * an audit_logs entry. Mirrors the admin console's own paths:
 *  - access approve/decline  ≈ admin requestTransitionAction (conflict-checked)
 *  - application approve/deny ≈ admin approveApplicationAction / setApplicationStatusAction
 *  - record/comp a contribution ≈ the console's manual payment_records trail
 *
 * Vocabulary: the database says bookings/villas/applications; the product says
 * access periods/Spaces/requests. The mapping happens here, at the write
 * boundary, and nowhere in the UI.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import {
  BLOCKING_STATUSES,
  fetchVillaClosures,
  isClosedFor,
  isRoomAvailable,
} from "@core/availability";
import { mintMagicLink } from "@core/invites";
import { sendMagicLinkEmail } from "@core/email";
import { config } from "@core/config";
import type { BookingStatus, CrmEntityType } from "@core/database.types";
import { getOperatorPrincipal } from "@/lib/guard";

export type ActionOutcome = { ok: boolean; message: string };

const ok = (message: string): ActionOutcome => ({ ok: true, message });
const fail = (message: string): ActionOutcome => ({ ok: false, message });

const euros = (minor: number) =>
  `€${Math.round(minor / 100).toLocaleString("en-GB")}`;

/* ------------------------------------------------------------------ *
 * Prefixed mobile ids → real table + CRM entity
 * ------------------------------------------------------------------ */

const REF = /^(req-bk|req-app|person|lead|vendor|space|gate|exp|tx|tx-due|area)-(.+)$/;

export type ResolvedEntity = { entityType: CrmEntityType; entityId: string };

/**
 * Resolves a prefixed mobile id to a verified row. Never trusts the client —
 * every ref hits the database before anything is written.
 */
export async function resolveEntityRef(
  ref: string,
): Promise<ResolvedEntity | { error: string }> {
  const match = REF.exec(ref);
  if (!match) return { error: "That record reference is not valid." };
  const [, prefix, rawId] = match;
  const db = getSupabaseAdmin();

  const check = async (
    table: string,
    entityType: CrmEntityType,
    id: string,
    missing: string,
  ): Promise<ResolvedEntity | { error: string }> => {
    const { data } = await db.from(table).select("id").eq("id", id).maybeSingle();
    if (!data) return { error: missing };
    return { entityType, entityId: id };
  };

  switch (prefix) {
    case "req-bk":
    case "tx-due":
      return check("bookings", "booking", rawId, "That access period no longer exists.");
    case "req-app":
      return check("applications", "application", rawId, "That application no longer exists.");
    case "person":
      return check("users", "user", rawId, "That person no longer exists.");
    case "lead":
      return check("leads", "lead", rawId, "That person no longer exists.");
    case "vendor":
      return check("staff_applications", "staff_application", rawId, "That partner no longer exists.");
    case "space":
    case "gate":
      return check("villas", "villa", rawId, "That Space no longer exists.");
    case "exp":
      return check("events", "event", rawId, "That experience no longer exists.");
    case "area":
      return check("rooms", "room", rawId, "That area no longer exists.");
    case "tx": {
      const { data } = await db
        .from("payment_records")
        .select("id, booking_id")
        .eq("id", rawId)
        .maybeSingle();
      if (!data) return { error: "That payment no longer exists." };
      return check("bookings", "booking", data.booking_id as string, "That access period no longer exists.");
    }
  }
  return { error: "That record reference is not valid." };
}

/* ------------------------------------------------------------------ *
 * Access requests (bookings)
 * ------------------------------------------------------------------ */

export type AccessDecision = "approve" | "decline" | "confirm";

const ACCESS_TRANSITION: Record<
  AccessDecision,
  { to: BookingStatus; from: BookingStatus[]; action: string; label: string }
> = {
  approve: { to: "approved", from: ["requested", "inquiry"], action: "booking.approve", label: "approved" },
  decline: { to: "cancelled", from: ["requested", "inquiry", "approved"], action: "booking.reject", label: "declined" },
  confirm: { to: "confirmed", from: ["approved", "deposit_paid", "paid"], action: "booking.confirm", label: "handoff started" },
};

export async function decideAccessRequest(input: {
  bookingId: string;
  decision: AccessDecision;
  note?: string;
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");

  const transition = ACCESS_TRANSITION[input.decision];
  if (!transition) return fail("Unknown decision.");
  const note = (input.note ?? "").trim().slice(0, 280) || null;

  const db = getSupabaseAdmin();
  const { data: booking } = await db
    .from("bookings")
    .select("id, room_id, villa_id, check_in, check_out, status, operator_notes, currency")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking) return fail("That access request no longer exists.");
  if (!transition.from.includes(booking.status as BookingStatus)) {
    return fail(`It is already ${booking.status} — no ${input.decision} needed.`);
  }

  try {
    // Approving claims the room — re-check the window against everyone else,
    // mirroring the admin console's approve path.
    if (input.decision === "approve") {
      const [{ data: others }, { data: blocks }, closures] = await Promise.all([
        db
          .from("bookings")
          .select("id, room_id, check_in, check_out, status")
          .eq("room_id", booking.room_id)
          .neq("id", booking.id)
          .in("status", BLOCKING_STATUSES)
          .lt("check_in", booking.check_out)
          .gt("check_out", booking.check_in),
        db
          .from("availability_blocks")
          .select("room_id, date, status")
          .eq("room_id", booking.room_id)
          .neq("status", "available")
          .gte("date", booking.check_in)
          .lt("date", booking.check_out),
        fetchVillaClosures(db, booking.villa_id, booking.check_in, booking.check_out),
      ]);
      if (isClosedFor(booking.room_id, booking.check_in, booking.check_out, closures)) {
        return fail("The house is closed for part of this window — approve is blocked.");
      }
      if (
        !isRoomAvailable(booking.room_id, booking.check_in, booking.check_out, others ?? [], blocks ?? [], closures)
      ) {
        return fail("That area is already committed for part of this window.");
      }
    }

    const { error } = await db
      .from("bookings")
      .update({
        status: transition.to,
        operator_notes: note
          ? `${booking.operator_notes ? `${booking.operator_notes}\n` : ""}${note}`
          : booking.operator_notes,
      })
      .eq("id", booking.id)
      .in("status", transition.from);
    if (error) return fail("The update did not go through.");

    await writeAudit({
      actorId: principal.id,
      actorEmail: principal.email,
      action: transition.action,
      entityType: "booking",
      entityId: booking.id,
      summary: `Window ${booking.check_in} → ${booking.check_out} ${transition.label}${note ? ` — ${note}` : ""} (mobile)`,
      meta: { surface: "mobile", from_status: booking.status, to_status: transition.to },
    });
    revalidatePath("/");
    revalidatePath("/requests");
    return ok(`Access ${transition.label}. An audit entry was created.`);
  } catch (err) {
    console.error("[record-actions] decideAccessRequest failed:", err);
    return fail("That could not be saved. Try again from the console.");
  }
}

/* ------------------------------------------------------------------ *
 * Applications (membership)
 * ------------------------------------------------------------------ */

export async function decideApplication(input: {
  applicationId: string;
  decision: "approve" | "deny";
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");

  const db = getSupabaseAdmin();
  const { data: application } = await db
    .from("applications")
    .select("*")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (!application) return fail("That application no longer exists.");
  if (application.status !== "submitted" && application.status !== "screening") {
    return fail(`It is already ${application.status}.`);
  }

  const name = `${application.first_name ?? ""} ${application.last_name ?? ""}`.trim() || application.email;

  try {
    if (input.decision === "deny") {
      const { error } = await db
        .from("applications")
        .update({
          status: "rejected",
          reviewed_by: principal.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", application.id);
      if (error) return fail("The update did not go through.");
      await writeAudit({
        actorId: principal.id,
        actorEmail: principal.email,
        action: "application.rejected",
        entityType: "application",
        entityId: application.id,
        summary: `${name} → rejected (mobile)`,
        meta: { surface: "mobile" },
      });
      revalidatePath("/");
      revalidatePath("/requests");
      return ok(`Declined ${name}. An audit entry was created.`);
    }

    // Approve — mirror of the console: member user, seeded profile, referral
    // credit, onboarding entrance link (outbox-gated), audit.
    const email = (application.email as string).toLowerCase();
    let userId = application.user_id as string | null;
    if (!userId) {
      const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
      userId = (existing?.id as string) ?? null;
    }
    if (userId) {
      await db.from("users").update({ role: "member" }).eq("id", userId);
    } else {
      const { data: created, error } = await db
        .from("users")
        .insert({ email, role: "member", lead_id: application.lead_id })
        .select("id")
        .single();
      if (error || !created) return fail("The member account could not be created.");
      userId = created.id as string;
    }

    const { data: existingProfile } = await db
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingProfile) {
      await db.from("profiles").insert({
        user_id: userId,
        first_name: application.first_name,
        last_name: application.last_name,
        headline: application.occupation,
        location: application.location,
        motivation: application.motivation,
        contribution: application.contribution,
        onboarding_completed: false,
      });
    }

    const { error: appError } = await db
      .from("applications")
      .update({
        status: "approved",
        user_id: userId,
        reviewed_by: principal.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", application.id);
    if (appError) return fail("The approval did not go through.");

    // Referral credit — best effort, only when the referrer resolves cleanly.
    if (application.lead_id) {
      const { data: lead } = await db
        .from("leads")
        .select("source")
        .eq("id", application.lead_id)
        .maybeSingle();
      const referrerName = lead?.source?.startsWith("member_referral:")
        ? (lead.source as string).slice("member_referral:".length)
        : null;
      if (referrerName) {
        const [first, ...rest] = referrerName.split(" ");
        const { data: matches } = await db
          .from("profiles")
          .select("user_id")
          .ilike("first_name", first || "")
          .ilike("last_name", rest.join(" ") || "%");
        if (matches?.length === 1) {
          await db.from("referral_credits").insert({
            referrer_user_id: matches[0].user_id,
            referred_user_id: userId,
            referred_email: email,
            status: "pending",
            note: `Auto-opened on approval of ${name}`,
          });
        }
      }
    }

    // Onboarding entrance link (logged in outbox; sent only in EMAIL_MODE=send).
    const link = await mintMagicLink(userId, email, config.baseUrl);
    await sendMagicLinkEmail({
      to: email,
      firstName: application.first_name,
      magicLink: link,
      intro:
        "The Circle has said yes. Step through to complete your profile and plan your first window at the Gate.",
      cta: "Complete your entrance",
      template: "approved_onboarding",
      entityType: "application",
      entityId: application.id,
      actorId: principal.id,
    });

    await writeAudit({
      actorId: principal.id,
      actorEmail: principal.email,
      action: "application.approve",
      entityType: "application",
      entityId: application.id,
      summary: `Approved ${name} — member access + onboarding link minted (mobile)`,
      meta: { surface: "mobile" },
    });
    revalidatePath("/");
    revalidatePath("/requests");
    return ok(`Approved ${name} — member access granted and their entrance link is on its way.`);
  } catch (err) {
    console.error("[record-actions] decideApplication failed:", err);
    return fail("That could not be saved. Try again from the console.");
  }
}

/* ------------------------------------------------------------------ *
 * Contributions (payment_records)
 * ------------------------------------------------------------------ */

/**
 * Settles an outstanding contribution against an access period.
 *  - "received": money actually arrived → kind balance (partial allowed).
 *  - "comp":     the house waives it → kind other with a Comped note, always
 *                the full outstanding amount, so the ledger reads zero.
 * Amounts are minor units throughout — total_price is already cents.
 */
export async function settleContribution(input: {
  bookingId: string;
  mode: "received" | "comp";
  amountMinor?: number;
  note?: string;
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");

  const db = getSupabaseAdmin();
  const { data: booking } = await db
    .from("bookings")
    .select("id, check_in, check_out, total_price, currency, status")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking) return fail("That access period no longer exists.");

  const { data: payments } = await db
    .from("payment_records")
    .select("id, kind, amount")
    .eq("booking_id", booking.id);
  const paid = (payments ?? [])
    .filter((p) => p.kind !== "refund")
    .reduce((n, p) => n + Math.round(Number(p.amount) || 0), 0);
  const outstanding = Math.max(0, Math.round(Number(booking.total_price) || 0) - paid);
  if (outstanding <= 0) return ok("Nothing is outstanding on this stay.");

  const note = (input.note ?? "").trim().slice(0, 280) || null;
  const isComp = input.mode === "comp";
  const amount = isComp
    ? outstanding
    : Math.min(outstanding, Math.max(1, Math.round(input.amountMinor ?? outstanding)));

  const { error } = await db.from("payment_records").insert({
    booking_id: booking.id,
    kind: isComp ? "other" : "balance",
    amount,
    currency: booking.currency || "EUR",
    method: isComp ? "comp" : "manual",
    note: isComp ? `Comped${note ? ` — ${note}` : ""}` : note,
    recorded_by: principal.id,
  });
  if (error) return fail("The record did not go through.");

  await writeAudit({
    actorId: principal.id,
    actorEmail: principal.email,
    action: isComp ? "booking.comp" : "booking.payment_received",
    entityType: "booking",
    entityId: booking.id,
    summary: `${isComp ? "Comped" : "Recorded"} ${euros(amount)} · ${booking.check_in} → ${booking.check_out}${note ? ` — ${note}` : ""} (mobile)`,
    meta: { surface: "mobile", amount_minor: amount, mode: input.mode },
  });
  revalidatePath("/");
  revalidatePath("/dues");
  return ok(
    isComp
      ? `Comped ${euros(amount)} — the stay now reads settled. An audit entry was created.`
      : `Recorded ${euros(amount)} received${amount < outstanding ? ` — ${euros(outstanding - amount)} still outstanding` : ""}. An audit entry was created.`,
  );
}

/* ------------------------------------------------------------------ *
 * Notes, follow-ups, closures
 * ------------------------------------------------------------------ */

export async function addEntityNote(input: {
  ref: string;
  body: string;
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");
  const body = (input.body ?? "").trim().slice(0, 500);
  if (!body) return fail("Write the note first.");

  const resolved = await resolveEntityRef(input.ref);
  if ("error" in resolved) return fail(resolved.error);

  const { error } = await getSupabaseAdmin().from("admin_notes").insert({
    author_id: principal.id,
    author_email: principal.email,
    entity_type: resolved.entityType,
    entity_id: resolved.entityId,
    body,
  });
  if (error) return fail("The note could not be saved.");

  await writeAudit({
    actorId: principal.id,
    actorEmail: principal.email,
    action: "mobile.note.add",
    entityType: resolved.entityType,
    entityId: resolved.entityId,
    summary: body.slice(0, 120),
  });
  revalidatePath("/");
  return ok("Note added.");
}

export async function createEntityFollowUp(input: {
  ref: string;
  title: string;
  dueAt?: string;
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");
  const title = (input.title ?? "").trim().slice(0, 140);
  if (!title) return fail("Give it a title first.");
  const dueAt = input.dueAt && /^\d{4}-\d{2}-\d{2}$/.test(input.dueAt) ? input.dueAt : null;

  const resolved = await resolveEntityRef(input.ref);
  if ("error" in resolved) return fail(resolved.error);

  const { error } = await getSupabaseAdmin().from("follow_ups").insert({
    owner_id: principal.id,
    owner_email: principal.email,
    entity_type: resolved.entityType,
    entity_id: resolved.entityId,
    title,
    due_at: dueAt,
  });
  if (error) return fail("The follow-up could not be saved.");

  await writeAudit({
    actorId: principal.id,
    actorEmail: principal.email,
    action: "mobile.follow_up.add",
    entityType: resolved.entityType,
    entityId: resolved.entityId,
    summary: title,
  });
  revalidatePath("/");
  return ok("Follow-up added.");
}

export async function publishExperience(input: {
  eventId: string;
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");

  const db = getSupabaseAdmin();
  const { data: event } = await db
    .from("events")
    .select("id, title, status")
    .eq("id", input.eventId)
    .maybeSingle();
  if (!event) return fail("That experience no longer exists.");
  if (event.status === "published") return ok(`${event.title} is already published.`);
  if (event.status !== "draft") return fail(`${event.title} cannot be published from its current state.`);

  const { error } = await db
    .from("events")
    .update({ status: "published" })
    .eq("id", event.id)
    .eq("status", "draft");
  if (error) return fail("The publish did not go through.");

  await writeAudit({
    actorId: principal.id,
    actorEmail: principal.email,
    action: "event.publish",
    entityType: "event",
    entityId: event.id,
    summary: `Published ${event.title} (mobile)`,
    meta: { surface: "mobile" },
  });
  revalidatePath("/");
  revalidatePath("/experiences");
  return ok(`${event.title} is published. An audit entry was created.`);
}

export async function completeFollowUp(input: {
  followUpId: string;
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");

  const db = getSupabaseAdmin();
  const { data: followUp } = await db
    .from("follow_ups")
    .select("id, title, status, entity_type, entity_id")
    .eq("id", input.followUpId)
    .maybeSingle();
  if (!followUp) return fail("That follow-up no longer exists.");
  if (followUp.status !== "open") return ok(`Already ${followUp.status}.`);

  const { error } = await db
    .from("follow_ups")
    .update({ status: "done" })
    .eq("id", followUp.id)
    .eq("status", "open");
  if (error) return fail("The update did not go through.");

  await writeAudit({
    actorId: principal.id,
    actorEmail: principal.email,
    action: "follow_up.complete",
    entityType: (followUp.entity_type as CrmEntityType | null) ?? "lead",
    entityId: (followUp.entity_id as string | null) ?? null,
    summary: `Completed follow-up "${followUp.title}" (mobile)`,
    meta: { surface: "mobile", follow_up_id: followUp.id },
  });
  revalidatePath("/");
  revalidatePath("/requests");
  return ok("Marked done. An audit entry was created.");
}

export async function closeSpaceForDay(input: {
  villaId: string;
  date: string;
  reason: string;
}): Promise<ActionOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("Preview mode — nothing is written here.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Pick a date first.");
  const reason = (input.reason ?? "").trim().slice(0, 140) || "Closed by operator";

  const db = getSupabaseAdmin();
  const { data: villa } = await db.from("villas").select("id, name").eq("id", input.villaId).maybeSingle();
  if (!villa) return fail("That Space no longer exists.");

  const { error } = await db.from("closure_periods").insert({
    villa_id: villa.id,
    room_id: null,
    starts_on: input.date,
    ends_on: input.date,
    reason,
  });
  if (error) return fail("The closure could not be saved.");

  await writeAudit({
    actorId: principal.id,
    actorEmail: principal.email,
    action: "mobile.space.close",
    entityType: "villa",
    entityId: villa.id,
    summary: `${villa.name} closed ${input.date} — ${reason}`,
  });
  revalidatePath("/");
  revalidatePath("/spaces");
  return ok(`${villa.name} is closed on ${input.date}. An audit entry was created.`);
}

/* ------------------------------------------------------------------ *
 * Audit trail (read)
 * ------------------------------------------------------------------ */

export type AuditTrailEntry = {
  action: string;
  summary: string;
  actor: string;
  at: string;
};

export async function getAuditTrail(input: {
  ref: string;
}): Promise<{ ok: boolean; entries: AuditTrailEntry[]; message?: string }> {
  const principal = await getOperatorPrincipal();
  if (!principal) return { ok: false, entries: [], message: "Preview mode — audit is a production surface." };

  const resolved = await resolveEntityRef(input.ref);
  if ("error" in resolved) return { ok: false, entries: [], message: resolved.error };

  const { data } = await getSupabaseAdmin()
    .from("audit_logs")
    .select("action, summary, actor_email, created_at")
    .eq("entity_type", resolved.entityType)
    .eq("entity_id", resolved.entityId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    ok: true,
    entries: (data ?? []).map((row) => ({
      action: row.action as string,
      summary: (row.summary as string) ?? "",
      actor: (row.actor_email as string) ?? "system",
      at: row.created_at as string,
    })),
  };
}
