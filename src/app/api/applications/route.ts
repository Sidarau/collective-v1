import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import {
  createHubSpotContact,
  createHubSpotDeal,
  isCrmExemptEmail,
} from "@core/hubspot";
import { sendNotificationEmail } from "@core/email";
import { config } from "@core/config";

export const runtime = "nodejs";

/**
 * Membership application (person-first). Requires a session — entrance is by
 * referral link only. Writes the application to Supabase, mirrors the person
 * into HubSpot (contact + membership deal) unless the email belongs to an
 * admin/operator account (so the team can test the funnel with real emails).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;

    const body = (await req.json()) as Record<string, string>;
    const {
      firstName,
      lastName,
      location,
      occupation,
      motivation,
      contribution,
      referredBy,
      instagram,
      linkedin,
      phone,
      whatsapp,
      preferredWindow,
    } = body;

    if (!firstName || !lastName || !motivation || !contribution) {
      return NextResponse.json(
        { error: "Name, motivation, and contribution are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const email = user.email;

    // One live application per person.
    const { data: existing } = await supabase
      .from("applications")
      .select("id, status")
      .eq("email", email)
      .not("status", "in", "(rejected)")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ success: true, applicationId: existing.id });
    }

    // 2. HubSpot mirror — skipped entirely for admin/operator emails.
    let hubspotContactId: string | null = null;
    let hubspotDealId: string | null = null;
    const crmExempt = await isCrmExemptEmail(email);
    if (!crmExempt) {
      try {
        hubspotContactId = await createHubSpotContact({
          email,
          firstName,
          lastName,
          phone,
          whatsapp,
          occupation,
          location,
        });
        hubspotDealId = await createHubSpotDeal(
          hubspotContactId,
          `Membership — ${firstName} ${lastName}`
        );
      } catch (err) {
        // CRM must never block the person. The row records sync failure.
        console.error("HubSpot sync failed for application:", err);
      }
    }

    const { data: application, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        lead_id: user.leadId || null,
        email,
        first_name: firstName,
        last_name: lastName,
        location,
        occupation,
        motivation,
        contribution,
        referred_by: referredBy,
        instagram,
        linkedin,
        preferred_window: preferredWindow,
        status: "submitted",
        hubspot_contact_id: hubspotContactId,
        hubspot_deal_id: hubspotDealId,
        hubspot_synced: !!hubspotContactId,
      })
      .select()
      .single();

    if (error || !application) {
      throw new Error(error?.message || "Failed to save application");
    }

    // Keep the lead row aligned with what the person told us.
    if (user.leadId) {
      await supabase
        .from("leads")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          whatsapp: whatsapp || null,
          hubspot_contact_id: hubspotContactId,
          hubspot_deal_id: hubspotDealId,
          status: "active",
        })
        .eq("id", user.leadId);
    }

    // Nudge the operators.
    if (config.adminEmail) {
      try {
        await sendNotificationEmail({
          to: config.adminEmail,
          subject: `New introduction: ${firstName} ${lastName}`,
          heading: "A new introduction has arrived",
          body: `${firstName} ${lastName} (${occupation || "—"}, ${location || "—"}) was referred by ${referredBy || "—"}. Review it in the operator console.`,
          ctaHref: config.adminUrl || undefined,
          ctaLabel: "Open console",
        });
      } catch (err) {
        console.error("Admin notification failed:", err);
      }
    }

    return NextResponse.json({ success: true, applicationId: application.id });
  } catch (error) {
    console.error("Application error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit" },
      { status: 500 }
    );
  }
}
