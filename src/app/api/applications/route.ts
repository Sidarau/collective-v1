import * as crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { sendNotificationEmail } from "@core/email";
import { writeAudit } from "@core/audit";
import { isToggleEnabled } from "@core/settings";
import { config } from "@core/config";

export const runtime = "nodejs";

/**
 * Membership application for invited leads (the signed-in /join flow — the
 * public referral form posts to /api/referral/[code] instead). Native CRM
 * only: Supabase is the system of record. Returns the screening scheduler URL
 * so the prospect books their host call immediately.
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

    // One live application per person — returning prospects go to scheduling.
    const { data: existing } = await supabase
      .from("applications")
      .select("id, status, screening_token")
      .eq("email", email)
      .not("status", "in", "(rejected)")
      .maybeSingle();
    if (existing) {
      let token = existing.screening_token as string | null;
      if (!token) {
        token = crypto.randomBytes(24).toString("hex");
        await supabase.from("applications").update({ screening_token: token }).eq("id", existing.id);
      }
      return NextResponse.json({
        success: true,
        applicationId: existing.id,
        schedulingUrl: `/screening/${token}`,
      });
    }

    const screeningToken = crypto.randomBytes(24).toString("hex");
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
        screening_token: screeningToken,
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
          status: "active",
        })
        .eq("id", user.leadId);
    }

    await writeAudit({
      action: "application.submitted",
      entityType: "application",
      entityId: application.id,
      summary: `${firstName} ${lastName} submitted an introduction (invited flow)`,
    });

    if (config.adminEmail && (await isToggleEnabled("notify.admin_on_application"))) {
      try {
        await sendNotificationEmail({
          to: config.adminEmail,
          subject: `New introduction: ${firstName} ${lastName}`,
          heading: "A new introduction has arrived",
          body: `${firstName} ${lastName} (${occupation || "—"}, ${location || "—"}) was referred by ${referredBy || "—"}. They're being offered a screening slot now.`,
          ctaHref: config.adminUrl || undefined,
          ctaLabel: "Open console",
          entityType: "application",
          entityId: application.id,
        });
      } catch (err) {
        console.error("Admin notification failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      schedulingUrl: `/screening/${screeningToken}`,
    });
  } catch (error) {
    console.error("Application error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit" },
      { status: 500 }
    );
  }
}
