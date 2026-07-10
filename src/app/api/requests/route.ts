import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import {
  BLOCKING_STATUSES,
  fetchVillaClosures,
  isRoomAvailable,
  nightsBetween,
} from "@core/availability";
import { sendNotificationEmail } from "@core/email";
import { config } from "@core/config";
import type { RoomRow, VillaRow } from "@core/database.types";

export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/requests — the unified request-to-attend action.
 * Members only. Availability is re-checked server-side at write time.
 */
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

    const body = (await req.json()) as {
      gateSlug?: string;
      roomId?: string;
      from?: string;
      to?: string;
      companionName?: string | null;
      notes?: string | null;
      eventId?: string | null;
      waitlist?: boolean;
    };
    const { gateSlug, from, to } = body;
    const isWaitlist = body.waitlist === true;
    let roomId = body.roomId;

    if (!gateSlug || (!roomId && !isWaitlist) || !from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from >= to) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (from < today) {
      return NextResponse.json({ error: "Window starts in the past" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let roomRow: RoomRow | null = null;
    let villa: Pick<VillaRow, "id" | "slug" | "name" | "status"> | null = null;

    if (isWaitlist) {
      // Waiting list is villa-level: park the entry on the gate's first room
      // as a placeholder. It never blocks availability (status=waitlisted).
      const { data: villaData } = await supabase
        .from("villas")
        .select("id, slug, name, status")
        .eq("slug", gateSlug)
        .maybeSingle();
      villa = villaData as Pick<VillaRow, "id" | "slug" | "name" | "status"> | null;
      if (!villa || villa.status !== "published") {
        return NextResponse.json({ error: "Gate not found" }, { status: 404 });
      }
      const { data: anyRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("villa_id", villa.id)
        .order("base_price_per_night", { ascending: true })
        .limit(1)
        .maybeSingle();
      roomRow = anyRoom as RoomRow | null;
      if (!roomRow) {
        return NextResponse.json({ error: "Gate has no rooms yet" }, { status: 404 });
      }
      roomId = roomRow.id;
    } else {
      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId!)
        .maybeSingle();

      roomRow = room as RoomRow | null;
      const { data: villaData } = roomRow
        ? await supabase
            .from("villas")
            .select("id, slug, name, status")
            .eq("id", roomRow.villa_id)
            .maybeSingle()
        : { data: null };
      villa = villaData as Pick<VillaRow, "id" | "slug" | "name" | "status"> | null;
      if (!roomRow || !villa || villa.slug !== gateSlug || villa.status !== "published") {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }

      // Re-check availability at write time (the client list can be stale).
      const [{ data: bookings }, { data: blocks }, closures] = await Promise.all([
        supabase
          .from("bookings")
          .select("room_id, check_in, check_out, status")
          .eq("room_id", roomId!)
          .in("status", BLOCKING_STATUSES)
          .lt("check_in", to)
          .gt("check_out", from),
        supabase
          .from("availability_blocks")
          .select("room_id, date, status")
          .eq("room_id", roomId!)
          .neq("status", "available")
          .gte("date", from)
          .lt("date", to),
        fetchVillaClosures(supabase, villa.id, from, to),
      ]);

      if (!isRoomAvailable(roomId!, from, to, bookings || [], blocks || [], closures)) {
        return NextResponse.json(
          { error: "That room was just taken for those dates. Pick another window." },
          { status: 409 }
        );
      }
    }

    // bookings.lead_id is NOT NULL — make sure this member has a lead row.
    let leadId = user.leadId;
    if (!leadId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone, whatsapp")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .upsert(
          {
            email: user.email,
            first_name: profile?.first_name || user.email.split("@")[0],
            last_name: profile?.last_name || "",
            phone: profile?.phone || null,
            whatsapp: profile?.whatsapp || null,
            source: "member_portal",
            status: "active",
          },
          { onConflict: "email" }
        )
        .select()
        .single();
      if (leadError || !lead) throw new Error(leadError?.message || "Lead upsert failed");
      leadId = lead.id;
      await supabase.from("users").update({ lead_id: lead.id }).eq("id", user.id);
    }

    const companion = body.companionName?.trim() || null;
    const nights = nightsBetween(from, to);

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        lead_id: leadId,
        user_id: user.id,
        room_id: roomId,
        villa_id: villa.id,
        check_in: from,
        check_out: to,
        guests: companion ? 2 : 1,
        guest_names: companion ? [companion] : [],
        companion_name: companion,
        event_id: body.eventId || null,
        status: isWaitlist ? "waitlisted" : "requested",
        total_price: roomRow.base_price_per_night * nights,
        currency: roomRow.currency,
        special_requests: isWaitlist
          ? `[Waiting list — any room] ${body.notes?.trim() || ""}`.trim()
          : body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error || !booking) throw new Error(error?.message || "Failed to save request");

    if (config.adminEmail) {
      try {
        await sendNotificationEmail({
          to: config.adminEmail,
          subject: isWaitlist
            ? `Waiting list: ${villa.name} · ${from} → ${to}`
            : `Window request: ${villa.name} · ${from} → ${to}`,
          heading: isWaitlist ? "New waiting-list entry" : "New window request",
          body: isWaitlist
            ? `${user.email} joined the waiting list for ${villa.name}, ${from} → ${to} (any room). They get the first call if those nights open.`
            : `${user.email} requested ${roomRow.name} at ${villa.name}, ${from} → ${to}${companion ? `, with ${companion}` : ""}. Review it in the operator console.`,
          ctaHref: config.adminUrl || undefined,
          ctaLabel: "Open console",
        });
      } catch (err) {
        console.error("Request notification failed:", err);
      }
    }

    return NextResponse.json({ success: true, bookingId: booking.id });
  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send request" },
      { status: 500 }
    );
  }
}
