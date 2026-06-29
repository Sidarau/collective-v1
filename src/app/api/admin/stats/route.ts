import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

interface RevenueRow {
  total_price: number | null;
}

export async function GET() {
  try {
    // Pending requests count
    const { count: pendingRequests, error: pendingError } = await getSupabaseAdmin()
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "requested");

    if (pendingError) throw new Error(pendingError.message);

    // Total approved/completed bookings
    const { count: totalBookings, error: totalError } = await getSupabaseAdmin()
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .in("status", ["approved", "paid", "confirmed", "completed"]);

    if (totalError) throw new Error(totalError.message);

    // Revenue from approved/completed bookings (stored in cents)
    const { data: revenueData, error: revenueError } = await getSupabaseAdmin()
      .from("bookings")
      .select("total_price")
      .in("status", ["approved", "paid", "confirmed", "completed"])
      .returns<RevenueRow[]>();

    if (revenueError) throw new Error(revenueError.message);

    const revenue = (revenueData || []).reduce(
      (sum, row) => sum + (row.total_price || 0),
      0
    );

    return NextResponse.json({
      pendingRequests: pendingRequests || 0,
      totalBookings: totalBookings || 0,
      revenue,
    });
  } catch (error: unknown) {
    console.error("Admin stats error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
