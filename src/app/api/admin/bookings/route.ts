import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "requested";

    const { data: bookings, error } = await getSupabaseAdmin()
      .from("bookings")
      .select("*, leads(*), rooms(*)")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ bookings: bookings || [] });
  } catch (error: unknown) {
    console.error("Admin bookings error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch bookings";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
