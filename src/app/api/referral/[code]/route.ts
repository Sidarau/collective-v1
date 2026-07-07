import * as crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { sendNotificationEmail } from "@core/email";
import { writeAudit } from "@core/audit";
import { isToggleEnabled } from "@core/settings";
import { config } from "@core/config";
import { loadActiveReferralLink } from "@/lib/screening";
import type { ApplicationRow } from "@core/database.types";

export const runtime = "nodejs";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Public member application via referral link — the front door of the funnel.
 * No session required: the link itself is the invitation. Creates lead + user
 * (role lead) + application with a one-purpose screening token, then hands the
 * prospect straight to the call scheduler.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;

    // Honeypot: bots fill everything. Pretend success, write nothing.
    if (clean(body.website)) return NextResponse.json({ success: true });

    const link = await loadActiveReferralLink(code, "member");
    if (!link) {
      return NextResponse.json({ error: "This door is no longer open." }, { status: 404 });
    }

    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const email = clean(body.email).toLowerCase();
    const motivation = clean(body.motivation);
    const contribution = clean(body.contribution);
    if (!firstName || !lastName || !email || !motivation || !contribution) {
      return NextResponse.json(
        { error: "Name, email, motivation, and contribution are required." },
        { status: 400 }
      );
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Members and operators don't re-apply.
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, role, lead_id")
      .eq("email", email)
      .maybeSingle();
    if (existingUser && existingUser.role !== "lead") {
      return NextResponse.json(
        { error: "You already belong to the Circle — sign in instead.", redirect: "/login" },
        { status: 409 }
      );
    }

    // One live application per person: returning prospects go back to scheduling.
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id, screening_token, status")
      .eq("email", email)
      .not("status", "in", "(rejected)")
      .maybeSingle();
    if (existingApp) {
      let token = existingApp.screening_token as string | null;
      if (!token) {
        token = crypto.randomBytes(24).toString("hex");
        await supabase.from("applications").update({ screening_token: token }).eq("id", existingApp.id);
      }
      return NextResponse.json({ success: true, schedulingUrl: `/screening/${token}` });
    }

    // Lead + user (role lead) so approval later upgrades in place.
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .upsert(
        {
          email,
          first_name: firstName,
          last_name: lastName,
          phone: clean(body.phone) || null,
          whatsapp: clean(body.whatsapp) || null,
          source: `referral_link:${link.code}`,
          status: "new",
        },
        { onConflict: "email" }
      )
      .select("id")
      .single();
    if (leadError || !lead) throw new Error(leadError?.message || "Failed to create lead");

    let userId = existingUser?.id || null;
    if (!userId) {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({ email, role: "lead", lead_id: lead.id })
        .select("id")
        .single();
      if (userError || !newUser) throw new Error(userError?.message || "Failed to create user");
      userId = newUser.id;
    }

    const screeningToken = crypto.randomBytes(24).toString("hex");
    const { data: application, error: appError } = await supabase
      .from("applications")
      .insert({
        user_id: userId,
        lead_id: lead.id,
        email,
        first_name: firstName,
        last_name: lastName,
        location: clean(body.location) || null,
        occupation: clean(body.occupation) || null,
        motivation,
        contribution,
        referred_by: clean(body.referredBy) || link.label,
        instagram: clean(body.instagram) || null,
        linkedin: clean(body.linkedin) || null,
        preferred_window: clean(body.preferredWindow) || null,
        status: "submitted",
        screening_token: screeningToken,
        referral_link_id: link.id,
      })
      .select("id")
      .single();
    if (appError || !application) throw new Error(appError?.message || "Failed to save application");

    await supabase
      .from("referral_links")
      .update({ use_count: link.use_count + 1 })
      .eq("id", link.id);

    const app = application as Pick<ApplicationRow, "id">;
    await writeAudit({
      action: "application.submitted",
      entityType: "application",
      entityId: app.id,
      summary: `${firstName} ${lastName} applied via referral link "${link.label}"`,
      meta: { referral_code: link.code },
    });

    if (config.adminEmail && (await isToggleEnabled("notify.admin_on_application"))) {
      try {
        await sendNotificationEmail({
          to: config.adminEmail,
          subject: `New introduction: ${firstName} ${lastName}`,
          heading: "A new introduction has arrived",
          body: `${firstName} ${lastName} (${clean(body.occupation) || "—"}, ${clean(body.location) || "—"}) came through the "${link.label}" link. They're being offered a screening slot now.`,
          ctaHref: config.adminUrl || undefined,
          ctaLabel: "Open console",
          entityType: "application",
          entityId: app.id,
        });
      } catch (err) {
        console.error("Admin notification failed:", err);
      }
    }

    return NextResponse.json({ success: true, schedulingUrl: `/screening/${screeningToken}` });
  } catch (error) {
    console.error("Referral application error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit" },
      { status: 500 }
    );
  }
}
