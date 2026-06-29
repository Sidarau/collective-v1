import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
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

function verifyHubSpotSignature(
  signature: string,
  body: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "base64"),
    Buffer.from(expected, "base64")
  );
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-hubspot-signature-v3");
    const body = await req.text();

    if (config.nodeEnv === "production") {
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
      if (!secret) {
        console.error("HUBSPOT_WEBHOOK_SECRET is not configured");
        return NextResponse.json(
          { error: "Webhook verification not configured" },
          { status: 500 }
        );
      }
      if (!verifyHubSpotSignature(signature, body, secret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const events = JSON.parse(body || "[]") as HubSpotWebhookEvent[];
    const supabaseAdmin = getSupabaseAdmin();

    for (const event of Array.isArray(events) ? events : [events]) {
      const dealId = event.objectId || event.dealId;
      if (!dealId) continue;

      const dealIdStr = dealId.toString();

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
