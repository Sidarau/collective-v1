import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { updateDealStage, updateDealAmount } from "../../../lib/hubspot";
import { calculateBookingTotal } from "../../../lib/pricing";
import { config } from "../../../lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, roomId, villaId, checkIn, checkOut, guests, guestNames, specialRequests } = body;

    if (!leadId || !roomId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: "Lead ID, room ID, check-in, and check-out dates are required" },
        { status: 400 }
      );
    }

    // 1. Calculate pricing
    const { total, currency, nights } = await calculateBookingTotal(roomId, checkIn, checkOut);

    // 2. Check availability
    const { data: blocks, error: availError } = await supabaseAdmin
      .from("availability_blocks")
      .select("*")
      .eq("room_id", roomId)
      .gte("date", checkIn)
      .lt("date", checkOut)
      .neq("status", "available");

    if (availError) {
      throw new Error(`Availability check failed: ${availError.message}`);
    }

    if (blocks && blocks.length > 0) {
      return NextResponse.json(
        { error: "Room is not available for selected dates" },
        { status: 409 }
      );
    }

    // 3. Get lead for HubSpot deal ID
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("hubspot_deal_id")
      .eq("id", leadId)
      .single();

    // 4. Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        lead_id: leadId,
        room_id: roomId,
        villa_id: villaId,
        check_in: checkIn,
        check_out: checkOut,
        guests: guests || 1,
        guest_names: guestNames || [],
        status: "requested",
        total_price: total,
        currency,
        special_requests: specialRequests,
        hubspot_deal_id: lead?.hubspot_deal_id,
      })
      .select()
      .single();

    if (bookingError) {
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    // 5. Update HubSpot deal stage
    if (lead?.hubspot_deal_id) {
      await updateDealStage(lead.hubspot_deal_id, config.hubspotStageRequested);
      await updateDealAmount(lead.hubspot_deal_id, total / 100); // Convert cents to euros
    }

    // 6. Block availability
    const dates: string[] = [];
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }

    const availabilityInserts = dates.map((date) => ({
      room_id: roomId,
      date,
      status: "booked" as const,
      booking_id: booking.id,
    }));

    await supabaseAdmin.from("availability_blocks").insert(availabilityInserts);

    // 7. TODO: Notify Don (HubSpot notification / email / WhatsApp)

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      total: total / 100,
      currency,
      nights,
      status: "requested",
      message: "Booking request submitted. Don will review and approve shortly.",
    });
  } catch (error: any) {
    console.error("Booking request error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit booking request" },
      { status: 500 }
    );
  }
}
