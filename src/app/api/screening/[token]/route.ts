import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { sendNotificationEmail, sendTrackedEmail } from "@core/email";
import { writeAudit } from "@core/audit";
import { isToggleEnabled } from "@core/settings";
import { config } from "@core/config";
import {
  computeOpenSlots,
  getDefaultScreeningHost,
  isSlotOpen,
  loadSlotInputs,
} from "@core/scheduling";
import { deleteGoogleEvent, pushGoogleEvent } from "@core/google-calendar";
import { googleCalendarUrl } from "@core/ics";
import { fmtCallTime, resolveScreeningToken } from "@/lib/screening";

export const runtime = "nodejs";

/** Open slots for the token's kind — used by the scheduler page to refresh. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const context = await resolveScreeningToken(token);
  if (!context) return NextResponse.json({ error: "Unknown link" }, { status: 404 });

  const host = context.existingCall?.admin_id || (await getDefaultScreeningHost());
  const slots = computeOpenSlots(await loadSlotInputs(context.kind, host));
  return NextResponse.json({ kind: context.kind, slots });
}

/**
 * Book (or rebook) the 15-minute call. Server recomputes availability before
 * writing, so forged times and races both land on a 409.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const context = await resolveScreeningToken(token);
    if (!context) return NextResponse.json({ error: "Unknown link" }, { status: 404 });

    const { startsAt } = (await req.json()) as { startsAt?: string };
    if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
      return NextResponse.json({ error: "Pick a time" }, { status: 400 });
    }

    // Reschedules stay with the original host; fresh bookings go to the default (Dominik).
    const host = context.existingCall?.admin_id || (await getDefaultScreeningHost());
    const slot = isSlotOpen(await loadSlotInputs(context.kind, host), new Date(startsAt).toISOString());
    if (!slot) {
      return NextResponse.json(
        { error: "That window was just taken — choose another." },
        { status: 409 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Rescheduling replaces the previous call (and its synced Google events).
    if (context.existingCall) {
      await supabase
        .from("screening_calls")
        .update({ status: "cancelled", notes: "Rescheduled by prospect" })
        .eq("id", context.existingCall.id);
      await deleteGoogleEvent(context.existingCall.google_event_ids);
    }

    const { data: call, error } = await supabase
      .from("screening_calls")
      .insert({
        kind: context.kind,
        application_id: context.applicationId,
        staff_application_id: context.staffApplicationId,
        prospect_name: context.firstName,
        prospect_email: context.email,
        scheduled_at: slot.startsAt,
        duration_minutes: slot.durationMinutes,
        timezone: slot.timezone,
        status: "scheduled",
        admin_id: host,
      })
      .select("id")
      .single();
    if (error || !call) throw new Error(error?.message || "Booking failed");

    // Two-way sync, push direction: land the call in every connected admin's
    // Google Calendar. Fail-soft — a Google outage never blocks the booking.
    try {
      const eventIds = await pushGoogleEvent(
        {
          summary: `${config.brandName} — ${context.kind === "member" ? "screening" : "interview"}: ${context.firstName}`,
          description: `${context.email}\nBooked via the scheduling link.`,
          startIso: slot.startsAt,
          endIso: new Date(
            new Date(slot.startsAt).getTime() + slot.durationMinutes * 60_000
          ).toISOString(),
        },
        host
      );
      if (Object.keys(eventIds).length) {
        await supabase
          .from("screening_calls")
          .update({ google_event_ids: eventIds })
          .eq("id", call.id);
      }
    } catch (err) {
      console.error("Google Calendar push failed:", err);
    }

    // Funnel stage follows the booking.
    if (context.applicationId) {
      await supabase
        .from("applications")
        .update({ status: "screening" })
        .eq("id", context.applicationId)
        .eq("status", "submitted");
    }
    if (context.staffApplicationId) {
      await supabase
        .from("staff_applications")
        .update({ status: "interview_scheduled" })
        .eq("id", context.staffApplicationId);
    }

    const timeLabel = fmtCallTime(slot.startsAt, slot.timezone);
    const calendarUrl = googleCalendarUrl({
      start: new Date(slot.startsAt),
      durationMinutes: slot.durationMinutes,
      title: `${config.brandName} — call with the host`,
      description: "A short conversation ahead of your stay at the Gate.",
    });

    const entityType = context.kind === "member" ? "application" : "staff_application";
    const entityId = context.applicationId || context.staffApplicationId;

    if (await isToggleEnabled("notify.prospect_on_screening_booked")) {
      await sendTrackedEmail({
        to: context.email,
        subject: `Your call with the host — ${timeLabel}`,
        heading: `Dear ${context.firstName},`,
        body: `Your fifteen minutes with the host are set for ${timeLabel}. We'll call you — keep your phone close.`,
        ctaHref: calendarUrl,
        ctaLabel: "Add to calendar",
        footnote: "Need a different time? Reopen your scheduling link and choose again.",
        template: "screening_confirmed",
        entityType,
        entityId,
        meta: { scheduled_at: slot.startsAt, calendar_url: calendarUrl },
      });
    }

    if (config.adminEmail && (await isToggleEnabled("notify.admin_on_screening_booked"))) {
      await sendNotificationEmail({
        to: config.adminEmail,
        subject: `Screening booked: ${context.firstName} — ${timeLabel}`,
        heading: "A call landed in the schedule",
        body: `${context.firstName} (${context.email}) booked the ${
          context.kind === "member" ? "member screening" : "vendor interview"
        } for ${timeLabel}.`,
        ctaHref: config.adminUrl ? `${config.adminUrl}/schedule` : undefined,
        ctaLabel: "Open schedule",
        entityType,
        entityId,
      });
    }

    await writeAudit({
      action: "screening.booked",
      entityType: "screening_call",
      entityId: call.id,
      summary: `${context.firstName} booked ${context.kind} call — ${timeLabel}`,
      meta: { scheduled_at: slot.startsAt, rescheduled: !!context.existingCall },
    });

    return NextResponse.json({
      success: true,
      scheduledAt: slot.startsAt,
      timezone: slot.timezone,
      timeLabel,
      calendarUrl,
    });
  } catch (error) {
    console.error("Screening booking error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Booking failed" },
      { status: 500 }
    );
  }
}
