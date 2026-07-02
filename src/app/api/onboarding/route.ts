import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { createHubSpotContact, createHubSpotDeal, updateContactMagicLink } from "../../../lib/hubspot";
import { sendMagicLinkEmail } from "../../../lib/email";
import { config } from "../../../lib/config";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      firstName,
      lastName,
      phone,
      whatsapp,
      dietaryRestrictions,
      source = "whatsapp",
    } = body;

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Email, first name, and last name are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Create or update HubSpot contact
    let hubspotContactId: string;
    try {
      hubspotContactId = await createHubSpotContact({
        email,
        firstName,
        lastName,
        phone,
        whatsapp,
        source,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Contact already exists")) {
        // Extract existing ID from error message
        const match = message.match(/Existing ID: (\d+)/);
        hubspotContactId = match ? match[1] : "";
        if (!hubspotContactId) throw err;
      } else {
        throw err;
      }
    }

    // 2. Create HubSpot deal
    const dealName = `${config.villaName} - ${firstName} ${lastName}`;
    const hubspotDealId = await createHubSpotDeal(hubspotContactId, dealName);

    // 3. Create lead in Supabase
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        whatsapp,
        dietary_restrictions: dietaryRestrictions,
        hubspot_contact_id: hubspotContactId,
        hubspot_deal_id: hubspotDealId,
        source,
        status: "new",
      })
      .select()
      .single();

    if (leadError) {
      throw new Error(`Failed to create lead: ${leadError.message}`);
    }

    if (!lead) {
      throw new Error("Lead creation returned no data");
    }

    // 4. Create user account
    const magicToken = crypto.randomBytes(32).toString("hex");
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        email,
        role: "lead",
        lead_id: lead.id,
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to create user: ${userError.message}`);
    }

    if (!user) {
      throw new Error("User creation returned no data");
    }

    // 5. Store magic token
    await supabaseAdmin.from("magic_tokens").insert({
      user_id: user.id,
      token: magicToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // 6. Build portal login link and send email
    const portalLink = `${config.baseUrl}/login?email=${encodeURIComponent(
      email
    )}&token=${magicToken}`;

    try {
      await updateContactMagicLink(hubspotContactId, portalLink);
    } catch (hubspotError: unknown) {
      console.error("Failed to update HubSpot contact with magic link:", hubspotError);
    }

    try {
      await sendMagicLinkEmail({ to: email, firstName, magicLink: portalLink });
    } catch (emailError: unknown) {
      console.error("Failed to send magic link email:", emailError);
      // Non-blocking: still return the link so Don can share it manually if needed
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      userId: user.id,
      portalLink: config.nodeEnv === "production" ? undefined : portalLink,
      message:
        "Account created. Check your email for the magic link, or Don will share it with you directly.",
    });
  } catch (error: unknown) {
    console.error("Onboarding error:", error);
    const message = error instanceof Error ? error.message : "Failed to create account";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
