import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import type { EventRow, RsvpStatus } from "@core/database.types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    if (!["member", "admin", "operator"].includes(user.role)) {
      return NextResponse.json({ error: "Membership required" }, { status: 403 });
    }

    const { eventId, status: rawStatus } = (await req.json()) as {
      eventId?: string;
      status?: string;
    };
    if (!eventId || !["going", "interested", "declined"].includes(rawStatus || "")) {
      return NextResponse.json({ error: "Invalid RSVP" }, { status: 400 });
    }
    const status = rawStatus as RsvpStatus;

    const supabase = getSupabaseAdmin();
    const { data: event } = await supabase
      .from("events")
      .select("id, status, capacity, hard_capacity")
      .eq("id", eventId)
      .maybeSingle();

    const eventRow = event as Pick<EventRow, "id" | "status" | "capacity" | "hard_capacity"> | null;
    if (!eventRow || eventRow.status !== "published") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Members see `capacity`; RSVPs are actually allowed up to the hidden
    // `hard_capacity` when the operators set one (overbook buffer).
    const rsvpLimit = eventRow.hard_capacity ?? eventRow.capacity;
    if (status === "going" && rsvpLimit) {
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("user_id, status")
        .eq("event_id", eventId)
        .eq("status", "going");
      const going = (rsvps || []).filter((r) => r.user_id !== user.id).length;
      if (going >= rsvpLimit) {
        return NextResponse.json({ error: "This one is full" }, { status: 409 });
      }
    }

    const { error } = await supabase
      .from("event_rsvps")
      .upsert({ event_id: eventId, user_id: user.id, status }, { onConflict: "event_id,user_id" });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RSVP error:", error);
    return NextResponse.json({ error: "Failed to RSVP" }, { status: 500 });
  }
}
