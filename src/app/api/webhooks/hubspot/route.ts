import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { config } from "../../../../lib/config";

interface HubSpotWebhookEvent {
  eventId?: number;
  subscriptionType?: string;
  objectId?: number;
  propertyName?: string;
  propertyValue?: string;
  dealId?: number;
}

export async function POST(req: NextRequest) {
  try {
    // In production, validate HubSpot signature here
    const signature = req.headers.get("x-hubspot-signature-v3");
    if (!signature && config.nodeEnv === "production") {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const events = (await req.json()) as HubSpotWebhookEvent[];
    const supabaseAdmin = getSupabaseAdmin();

    for (const event of Array.isArray(events) ? events : [events]) {
      const dealId = event.objectId || event.dealId;
      if (!dealId) continue;

      const dealIdStr = dealId.toString();

      // Map deal stage changes to booking status
      if (
        event.subscriptionType === "deal.propertyChange" &&
        event.propertyName === "dealstage"
      ) {
        const stage = event.propertyValue;
        let status: string | null = null;

        if (stage === config.hubspotStageApproved) status = "approved";
        else if (stage === config.hubspotStagePaid) status = "paid";
        else if (stage === config.hubspotStageBooked) status = "confirmed";
        else if (stage === config.hubspotStageCancelled) status = "cancelled";

        if (status) {
          await supabaseAdmin
            .from("bookings")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("hubspot_deal_id", dealIdStr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("HubSpot webhook error:", error);
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
