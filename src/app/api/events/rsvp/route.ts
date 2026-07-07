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
      .select("id, status, capacity")
      .eq("id", eventId)
      .maybeSingle();

    const eventRow = event as Pick<EventRow, "id" | "status" | "capacity"> | null;
    if (!eventRow || eventRow.status !== "published") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (status === "going" && eventRow.capacity) {
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("user_id, status")
        .eq("event_id", eventId)
        .eq("status", "going");
      const going = (rsvps || []).filter((r) => r.user_id !== user.id).length;
      if (going >= eventRow.capacity) {
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
