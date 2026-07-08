import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import {
  BLOCKING_STATUSES,
  filterAvailableRooms,
  nightsBetween,
} from "@core/availability";
import type { RoomRow, VillaRow } from "@core/database.types";

export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/availability?gate=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const gateSlug = searchParams.get("gate") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from >= to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (from < today) {
    return NextResponse.json({ error: "Window starts in the past" }, { status: 400 });
  }
  if (nightsBetween(from, to) > 30) {
    return NextResponse.json({ error: "Windows are limited to 30 nights" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: gate } = await supabase
    .from("villas")
    .select("id, status")
    .eq("slug", gateSlug)
    .maybeSingle();

  if (!gate || gate.status !== "published") {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  const { data: roomRows } = await supabase
    .from("rooms")
    .select("*")
    .eq("villa_id", (gate as Pick<VillaRow, "id">).id);
  const rooms = (roomRows as RoomRow[]) || [];
  const roomIds = rooms.map((r) => r.id);

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase
      .from("bookings")
      .select("room_id, check_in, check_out, status")
      .in("room_id", roomIds)
      .in("status", BLOCKING_STATUSES)
      .lt("check_in", to)
      .gt("check_out", from),
    supabase
      .from("availability_blocks")
      .select("room_id, date, status")
      .in("room_id", roomIds)
      .neq("status", "available")
      .gte("date", from)
      .lt("date", to),
  ]);

  const nights = nightsBetween(from, to);
  const available = filterAvailableRooms(rooms, from, to, bookings || [], blocks || []).map(
    (room) => ({
      id: room.id,
      slug: room.slug,
      name: room.name,
      bed_type: room.bed_type,
      image: room.images[0] || null,
      nights,
      price_per_night: room.base_price_per_night,
      total: room.base_price_per_night * nights,
      currency: room.currency,
    })
  );

  return NextResponse.json({ rooms: available, nights });
}
