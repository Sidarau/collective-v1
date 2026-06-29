import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { updateDealStage } from "../../../../lib/hubspot";
import { config } from "../../../../lib/config";
import { requireAdminOrOperator } from "../../../../lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    const authError = requireAdminOrOperator(session);
    if (authError) return authError;

    const body = await req.json();
    const { bookingId, action, operatorNotes } = body;

    if (!bookingId || !action) {
      return NextResponse.json(
        { error: "Booking ID and action are required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Get booking with lead info
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("*, leads(hubspot_deal_id)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const newStatus = action === "approve" ? "approved" : "cancelled";
    const hubspotStage =
      action === "approve"
        ? config.hubspotStageApproved
        : config.hubspotStageBooked; // Rejected deals go to a terminal stage

    // Build operator notes update
    const existingNotes = (booking as { operator_notes?: string | null }).operator_notes || "";
    const updatedNotes = operatorNotes
      ? `${existingNotes ? existingNotes + "\n" : ""}[Operator]: ${operatorNotes}`
      : existingNotes;

    // 2. Update booking status
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        status: newStatus,
        operator_notes: updatedNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // 3. Update HubSpot deal stage
    const lead = (booking as { leads?: { hubspot_deal_id?: string | null } | null }).leads;
    if (lead?.hubspot_deal_id) {
      await updateDealStage(lead.hubspot_deal_id, hubspotStage);
    }

    // 4. If rejected, free up availability
    if (action === "reject") {
      await supabaseAdmin
        .from("availability_blocks")
        .update({ status: "available", booking_id: null })
        .eq("booking_id", bookingId);
    }

    return NextResponse.json({
      success: true,
      bookingId,
      status: newStatus,
      message:
        action === "approve"
          ? "Booking approved. Lead will be notified."
          : "Booking rejected. Room availability restored.",
    });
  } catch (error: unknown) {
    console.error("Booking approval error:", error);
    const message = error instanceof Error ? error.message : "Failed to process booking";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
