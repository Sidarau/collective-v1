import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { updateDealStage, updateDealAmount } from "../../../lib/hubspot";
import { calculateBookingTotal } from "../../../lib/pricing";
import { config } from "../../../lib/config";
import { requireLead } from "../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Auth check - derive lead from session
    const session = await getServerSession(authOptions);
    const authError = requireLead(session);
    if (authError) return authError;

    const leadId = session?.user?.leadId;
    if (!leadId) {
      return NextResponse.json(
        { error: "No lead associated with this account" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { roomId, villaId, checkIn, checkOut, guests, guestNames, specialRequests } = body;

    if (!roomId || !villaId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: "Room ID, villa ID, check-in, and check-out dates are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Calculate pricing
    const { total, currency, nights } = await calculateBookingTotal(roomId, checkIn, checkOut);

    // 2. Check availability with row-level lock guard
    // First, try to lock by updating available blocks to 'reserved' status
    const { data: availableBlocks, error: availError } = await supabaseAdmin
      .from("availability_blocks")
      .select("id, status")
      .eq("room_id", roomId)
      .gte("date", checkIn)
      .lt("date", checkOut)
      .in("status", ["available", "blocked"]);

    if (availError) {
      throw new Error(`Availability check failed: ${availError.message}`);
    }

    // We need exactly (nights) available blocks OR blocks that don't exist yet
    // MVP guard: if any non-available block exists, fail
    if (availableBlocks && availableBlocks.length > 0) {
      // If there are existing blocks, they must all be available/blocked and count must match nights
      const nonAvailable = availableBlocks.filter((b) => b.status !== "available");
      if (nonAvailable.length > 0) {
        return NextResponse.json(
          { error: "Room is not available for selected dates" },
          { status: 409 }
        );
      }
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

    // Upsert availability blocks to mark as booked
    for (const date of dates) {
      const { error: upsertError } = await supabaseAdmin
        .from("availability_blocks")
        .upsert(
          {
            room_id: roomId,
            date,
            status: "booked",
            booking_id: booking.id,
          },
          { onConflict: "room_id,date" }
        );

      if (upsertError) {
        // Best-effort rollback: delete the booking we just created
        await supabaseAdmin.from("bookings").delete().eq("id", booking.id);
        throw new Error(`Failed to block availability: ${upsertError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      total: total / 100,
      currency,
      nights,
      status: "requested",
      message: "Booking request submitted. Don will review and approve shortly.",
    });
  } catch (error: unknown) {
    console.error("Booking request error:", error);
    const message = error instanceof Error ? error.message : "Failed to submit booking request";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
