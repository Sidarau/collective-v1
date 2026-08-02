import "server-only";

/**
 * Composer writes — the create path behind the satin +.
 *
 * Every action here re-checks the operator session server-side (the guard
 * authorizes the page; the action authorizes the write), validates the
 * payload, resolves the link target to a real row, writes, and leaves an
 * audit_logs entry. Material creates (due, access, experience) always arrive
 * confirmed — the ConfirmSheet gate lives in the client, and the action
 * trusts the confirmation only because the guard already established the
 * operator.
 *
 * Vocabulary: the database says bookings/villas; the product says access
 * periods/Spaces. The mapping happens here, at the write boundary, and
 * nowhere in the UI.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import type { CrmEntityType } from "@core/database.types";
import { getOperatorPrincipal } from "@/lib/guard";
import type { ComposerKind, LinkTargetKind } from "./contracts";

export type ComposerInput = {
  kind: ComposerKind;
  title: string;
  /** ISO date (YYYY-MM-DD) for day-scoped kinds; start datetime for experience. */
  date: string;
  people?: number;
  /** Euros as a decimal string ("120" or "120.50") — converted to cents here. */
  amount?: string;
  note?: string;
  link?: { id: string; kind: LinkTargetKind };
};

export type ComposerOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string };

/* ------------------------------------------------------------------ *
 * Link targets: prefixed mobile ids → real table + id + CRM entity
 * ------------------------------------------------------------------ */

type ResolvedLink = {
  tableId: string; // the real row id (uuid or slug)
  entityType: CrmEntityType;
  entityId: string;
  /** Villa id when the link is (or lives in) a Space/Gate. */
  villaId: string | null;
  /** User id when the link is a person. */
  userId: string | null;
};

const PREFIXED_ID = /^(space|gate|person|vendor|exp)-(.+)$/;

async function resolveLink(
  link: ComposerInput["link"],
): Promise<ResolvedLink | { error: string }> {
  if (!link) return { error: "Choose what this attaches to first." };
  const match = PREFIXED_ID.exec(link.id);
  if (!match) return { error: "That link target is not valid." };
  const rawId = match[2];
  const db = getSupabaseAdmin();

  switch (link.kind) {
    case "space":
    case "gate": {
      if (link.kind !== match[1]) break;
      const { data } = await db.from("villas").select("id").eq("id", rawId).maybeSingle();
      if (!data) return { error: "That Space no longer exists." };
      return { tableId: rawId, entityType: "villa", entityId: rawId, villaId: rawId, userId: null };
    }
    case "person": {
      if (match[1] !== "person") break;
      const { data } = await db.from("users").select("id").eq("id", rawId).maybeSingle();
      if (!data) return { error: "That person no longer exists." };
      return { tableId: rawId, entityType: "user", entityId: rawId, villaId: null, userId: rawId };
    }
    case "vendor": {
      if (match[1] !== "vendor") break;
      const { data } = await db.from("staff_applications").select("id").eq("id", rawId).maybeSingle();
      if (!data) return { error: "That partner no longer exists." };
      return { tableId: rawId, entityType: "staff_application", entityId: rawId, villaId: null, userId: null };
    }
    case "experience": {
      if (match[1] !== "exp") break;
      const { data } = await db.from("events").select("id, villa_id").eq("id", rawId).maybeSingle();
      if (!data) return { error: "That experience no longer exists." };
      return {
        tableId: rawId,
        entityType: "event",
        entityId: rawId,
        villaId: (data.villa_id as string | null) ?? null,
        userId: null,
      };
    }
  }
  return { error: "That link target is not valid." };
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const fail = (message: string): ComposerOutcome => ({ ok: false, message });

function cleanTitle(input: ComposerInput): string | null {
  const title = input.title.trim();
  if (!title) return null;
  return title.slice(0, 140);
}

function cleanNote(note?: string): string | null {
  const body = (note ?? "").trim();
  return body ? body.slice(0, 280) : null;
}

/** YYYY-MM-DD validation — the timeline works in days, not timestamps. */
function cleanDate(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function eurosToCents(amount?: string): number | null {
  if (!amount) return null;
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) return null;
  return Math.round(parsed * 100);
}

async function addNote(
  author: { id: string; email: string },
  entityType: CrmEntityType,
  entityId: string,
  body: string,
): Promise<void> {
  await getSupabaseAdmin().from("admin_notes").insert({
    author_id: author.id,
    author_email: author.email,
    entity_type: entityType,
    entity_id: entityId,
    body,
  });
}

/* ------------------------------------------------------------------ *
 * The write itself
 * ------------------------------------------------------------------ */

export async function createFromComposer(input: ComposerInput): Promise<ComposerOutcome> {
  const principal = await getOperatorPrincipal();
  if (!principal) return fail("No operator session.");
  if (!input || typeof input !== "object") return fail("Nothing to create.");

  const title = cleanTitle(input);
  if (!title) return fail("Give it a title first.");
  const note = cleanNote(input.note);

  const resolved = await resolveLink(input.link);
  if ("error" in resolved) return fail(resolved.error);

  const db = getSupabaseAdmin();
  const author = { id: principal.id, email: principal.email };

  try {
    switch (input.kind) {
      /* ---- Note: a note against whatever it links to. ---- */
      case "note": {
        const body = [title, note].filter(Boolean).join("\n");
        await addNote(author, resolved.entityType, resolved.entityId, body);
        await writeAudit({
          actorId: principal.id, actorEmail: principal.email,
          action: "mobile.composer.note",
          entityType: resolved.entityType, entityId: resolved.entityId,
          summary: title,
        });
        revalidatePath("/");
        return { ok: true, message: "Note added." };
      }

      /* ---- Request or follow-up: operators create follow-ups; member
         requests arrive through the doors, not the composer. ---- */
      case "request": {
        const { error } = await db.from("follow_ups").insert({
          owner_id: principal.id,
          owner_email: principal.email,
          entity_type: resolved.entityType,
          entity_id: resolved.entityId,
          title: note ? `${title} — ${note}` : title,
          due_at: cleanDate(input.date),
        });
        if (error) return fail("The follow-up could not be saved.");
        await writeAudit({
          actorId: principal.id, actorEmail: principal.email,
          action: "mobile.composer.follow_up",
          entityType: resolved.entityType, entityId: resolved.entityId,
          summary: title,
        });
        revalidatePath("/");
        return { ok: true, message: "Follow-up added." };
      }

      /* ---- Access period: an approved booking on the first area of the
         Space. Operators confirm on the spot; conflict + closure checks run
         before insert, mirroring the admin console's approve path. ---- */
      case "access": {
        if (!resolved.villaId) return fail("Access periods attach to a Space.");
        const checkIn = cleanDate(input.date);
        if (!checkIn) return fail("Pick a date first.");
        const people = Math.max(1, Math.min(20, Math.round(input.people ?? 2)));

        const [{ data: room }, { data: closures }] = await Promise.all([
          db.from("rooms").select("id").eq("villa_id", resolved.villaId)
            .order("name", { ascending: true }).limit(1).maybeSingle(),
          db.from("closure_periods").select("starts_on, ends_on, room_id")
            .eq("villa_id", resolved.villaId)
            .lte("starts_on", checkIn)
            .or(`ends_on.is.null,ends_on.gte.${checkIn}`),
        ]);
        if (!room) return fail("That Space has no areas yet.");
        if (closures?.length) return fail("That Space is closed on that date.");

        const checkOutDate = new Date(`${checkIn}T00:00:00Z`);
        checkOutDate.setUTCDate(checkOutDate.getUTCDate() + 1);
        const checkOut = checkOutDate.toISOString().slice(0, 10);

        const { data: conflicts } = await db
          .from("bookings").select("id")
          .eq("room_id", room.id)
          .in("status", ["requested", "approved", "deposit_paid", "paid", "confirmed"])
          .lt("check_in", checkOut).gt("check_out", checkIn);
        if (conflicts?.length) return fail("That area is already committed on that date.");

        const { data: lead } = await db.from("leads").select("id")
          .eq("email", principal.email.toLowerCase()).maybeSingle();

        const { data: booking, error } = await db
          .from("bookings")
          .insert({
            lead_id: lead?.id ?? principal.id,
            user_id: principal.id,
            room_id: room.id,
            villa_id: resolved.villaId,
            check_in: checkIn,
            check_out: checkOut,
            guests: people,
            guest_names: [principal.email],
            status: "confirmed",
            total_price: 0,
            currency: "EUR",
            operator_notes: note ? `Composer: ${title}\n${note}` : `Composer: ${title}`,
          })
          .select("id")
          .single();
        if (error || !booking) return fail("The access period could not be saved.");
        await writeAudit({
          actorId: principal.id, actorEmail: principal.email,
          action: "mobile.composer.access",
          entityType: "booking", entityId: booking.id,
          summary: `${title} · ${checkIn} · ${people} people`,
        });
        revalidatePath("/");
        return { ok: true, message: "Access period created." };
      }

      /* ---- Space reset / upkeep: a maintenance closure on the first area
         (or the whole Space) for that date, plus a note. ---- */
      case "space_reset": {
        if (resolved.entityType !== "villa" && resolved.entityType !== "staff_application") {
          return fail("Upkeep attaches to a Space or a partner.");
        }
        const on = cleanDate(input.date);
        if (!on) return fail("Pick a date first.");
        const body = [`${title}${note ? `\n${note}` : ""}`];

        if (resolved.entityType === "villa") {
          const { error } = await db.from("closure_periods").insert({
            villa_id: resolved.entityId,
            room_id: null,
            starts_on: on,
            ends_on: on,
            reason: `Upkeep: ${title}`,
          });
          if (error) return fail("The upkeep window could not be saved.");
        }
        await addNote(author, resolved.entityType, resolved.entityId, `Upkeep ${on}: ${body[0]}`);
        await writeAudit({
          actorId: principal.id, actorEmail: principal.email,
          action: "mobile.composer.upkeep",
          entityType: resolved.entityType, entityId: resolved.entityId,
          summary: `${title} · ${on}`,
        });
        revalidatePath("/");
        return { ok: true, message: "Upkeep scheduled." };
      }

      /* ---- Due or expense: a follow-up for the owed amount. Actual money
         movement stays in the console (payment_records need a booking);
         the composer records the obligation against a person or partner. ---- */
      case "due": {
        if (resolved.entityType !== "user" && resolved.entityType !== "staff_application") {
          return fail("Dues attach to a person or a partner.");
        }
        const cents = eurosToCents(input.amount);
        if (!cents) return fail("Add an amount first.");
        const dueDate = cleanDate(input.date);
        if (!dueDate) return fail("Pick a date first.");
        const euros = (cents / 100).toFixed(2).replace(/\.00$/, "");
        const { error } = await db.from("follow_ups").insert({
          owner_id: principal.id,
          owner_email: principal.email,
          entity_type: resolved.entityType,
          entity_id: resolved.entityId,
          title: `€${euros} — ${title}${note ? ` — ${note}` : ""}`,
          due_at: dueDate,
        });
        if (error) return fail("The due could not be saved.");
        await writeAudit({
          actorId: principal.id, actorEmail: principal.email,
          action: "mobile.composer.due",
          entityType: resolved.entityType, entityId: resolved.entityId,
          summary: `€${euros} · ${title}`,
        });
        revalidatePath("/");
        return { ok: true, message: "Due recorded." };
      }

      /* ---- Experience: a draft member event. Publishing stays a console
         decision — the composer never puts anything in front of members. ---- */
      case "experience": {
        const on = cleanDate(input.date);
        if (!on) return fail("Pick a date first.");
        const people = Math.max(1, Math.min(200, Math.round(input.people ?? 2)));
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
        const { data: event, error } = await db
          .from("events")
          .insert({
            title,
            slug: `${slug}-${Date.now().toString(36)}`,
            description: note,
            event_type: "gathering",
            audience: "member",
            status: "draft",
            start_at: `${on}T19:30:00+02:00`,
            capacity: people,
            villa_id: resolved.villaId,
            location_note: resolved.villaId ? null : title,
            created_by: principal.id,
          })
          .select("id")
          .single();
        if (error || !event) return fail("The experience could not be saved.");
        await writeAudit({
          actorId: principal.id, actorEmail: principal.email,
          action: "mobile.composer.experience",
          entityType: "event", entityId: event.id,
          summary: `${title} · ${on} · draft`,
        });
        revalidatePath("/");
        return { ok: true, message: "Experience drafted — publish it from the console when it's ready." };
      }
    }
  } catch (err) {
    console.error(`[composer] ${input.kind} failed:`, err);
    return fail("That could not be saved. Try again from the console.");
  }
}
