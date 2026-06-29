import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { updateDealStage } from "../../../../lib/hubspot";
import { config } from "../../../../lib/config";

export async function PATCH(req: NextRequest) {
  try {
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

    // 2. Update booking status
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        status: newStatus,
        notes: operatorNotes
          ? `${booking.notes || ""}\n[Operator]: ${operatorNotes}`
          : booking.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // 3. Update HubSpot deal stage
    if (booking.leads?.hubspot_deal_id) {
      await updateDealStage(booking.leads.hubspot_deal_id, hubspotStage);
    }

    // 4. If rejected, free up availability
    if (action === "reject") {
      await supabaseAdmin
        .from("availability_blocks")
        .update({ status: "available", booking_id: null })
        .eq("booking_id", bookingId);
    }

    // 5. TODO: Notify lead (email / WhatsApp)

    return NextResponse.json({
      success: true,
      bookingId,
      status: newStatus,
      message:
        action === "approve"
          ? "Booking approved. Lead will be notified."
          : "Booking rejected. Room availability restored.",
    });
  } catch (error: any) {
    console.error("Booking approval error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process booking" },
      { status: 500 }
    );
  }
}
