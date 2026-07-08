import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { sendNotificationEmail } from "@core/email";
import { config } from "@core/config";
import type { EventRow } from "@core/database.types";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanPhone(input: string): string {
  return input.trim().replace(/[\s\-()]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, string | boolean | undefined>;
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const phone = typeof body.phone === "string" ? cleanPhone(body.phone) : "";
    const instagram = typeof body.instagram === "string" ? body.instagram.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const consent = body.consent === true;

    if (!eventId || !firstName || !lastName || !EMAIL_RE.test(email) || !phone) {
      return NextResponse.json({ error: "Name, email, and phone are required." }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ error: "Please accept the Terms and Privacy notice." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: event } = await supabase
      .from("events")
      .select("id, title, status, audience, capacity, hard_capacity")
      .eq("id", eventId)
      .maybeSingle();
    const eventRow = event as Pick<EventRow, "id" | "title" | "status" | "audience" | "capacity" | "hard_capacity"> | null;
    if (!eventRow || eventRow.status !== "published" || eventRow.audience !== "public") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const [{ count: guestGoing }, { count: memberGoing }] = await Promise.all([
      supabase
        .from("event_guest_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "going")
        .neq("email", email),
      supabase
        .from("event_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "going"),
    ]);
    const limit = eventRow.hard_capacity ?? eventRow.capacity;
    const status = limit && (guestGoing || 0) + (memberGoing || 0) >= limit ? "waitlist" : "going";

    const { error } = await supabase.from("event_guest_rsvps").upsert(
      {
        event_id: eventId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        instagram: instagram || null,
        note: note || null,
        consent_terms: true,
        status,
      },
      { onConflict: "event_id,email" }
    );
    if (error) throw new Error(error.message);

    if (config.adminEmail) {
      await sendNotificationEmail({
        to: config.adminEmail,
        subject: `Public event RSVP: ${eventRow.title}`,
        heading: "New public event RSVP",
        body: `${firstName} ${lastName} requested ${status === "waitlist" ? "waitlist" : "guest list"} access for ${eventRow.title}. Email: ${email}. Phone: ${phone}.`,
        template: "public_event_rsvp",
        entityType: "event",
        entityId: eventId,
      });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Public event RSVP error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save your RSVP." },
      { status: 500 }
    );
  }
}
