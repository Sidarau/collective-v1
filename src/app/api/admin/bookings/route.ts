import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "requested";

    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("*, leads(*), rooms(*)")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ bookings: bookings || [] });
  } catch (error: any) {
    console.error("Admin bookings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
