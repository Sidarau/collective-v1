import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export async function GET(_req: NextRequest) {
  try {
    // Pending requests count
    const { count: pendingCount, error: pendingError } = await supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "requested");

    if (pendingError) throw new Error(pendingError.message);

    // Total bookings count (all non-cancelled)
    const { count: totalCount, error: totalError } = await supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled");

    if (totalError) throw new Error(totalError.message);

    // Revenue from approved/paid/confirmed bookings
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from("bookings")
      .select("total_price")
      .in("status", ["approved", "deposit_paid", "paid", "confirmed", "completed"]);

    if (revenueError) throw new Error(revenueError.message);

    const revenue = (revenueData || []).reduce(
      (sum, b) => sum + (b.total_price || 0),
      0
    );

    return NextResponse.json({
      pendingRequests: pendingCount || 0,
      totalBookings: totalCount || 0,
      revenue,
    });
  } catch (error: any) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
