import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { sendNotificationEmail } from "@core/email";
import { writeAudit } from "@core/audit";
import { isToggleEnabled } from "@core/settings";
import { config } from "@core/config";
import { loadActiveReferralLink } from "@/lib/screening";

export const runtime = "nodejs";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Public vendor/staff application via referral link. Unlike the member funnel,
 * scheduling is NOT offered immediately — operators prescreen first, then
 * invite to a 15-minute interview from the console.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;

    if (clean(body.website)) return NextResponse.json({ success: true });

    const link = await loadActiveReferralLink(code, ["vendor", "staff"]);
    if (!link) {
      return NextResponse.json({ error: "This door is no longer open." }, { status: 404 });
    }

    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const roleApplied = clean(body.roleApplied);
    if (!name || !email || !roleApplied) {
      return NextResponse.json({ error: "Name, email, and role are required." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // One live application per candidate.
    const { data: existing } = await supabase
      .from("staff_applications")
      .select("id")
      .eq("email", email)
      .not("status", "in", "(rejected,hired)")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ success: true, existing: true });
    }

    const { data, error } = await supabase
      .from("staff_applications")
      .insert({
        name,
        email,
        phone: clean(body.phone) || null,
        company: clean(body.company) || null,
        role_applied: roleApplied,
        experience: clean(body.experience) || null,
        links: clean(body.links) ? { raw: clean(body.links) } : {},
        message: clean(body.message) || null,
        status: "submitted",
        referral_link_id: link.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to save application");

    await supabase
      .from("referral_links")
      .update({ use_count: link.use_count + 1 })
      .eq("id", link.id);

    await writeAudit({
      action: "staff_application.submitted",
      entityType: "staff_application",
      entityId: data.id,
      summary: `${name} applied for ${roleApplied} via "${link.label}"`,
      meta: { referral_code: link.code },
    });

    if (config.adminEmail && (await isToggleEnabled("notify.admin_on_vendor_application"))) {
      try {
        await sendNotificationEmail({
          to: config.adminEmail,
          subject: `Vendor application: ${name} — ${roleApplied}`,
          heading: "New vendor application",
          body: `${name}${clean(body.company) ? ` (${clean(body.company)})` : ""} applied for ${roleApplied} through the "${link.label}" link. Prescreen them in the console, then invite to an interview.`,
          ctaHref: config.adminUrl ? `${config.adminUrl}/vendors` : undefined,
          ctaLabel: "Open vendor funnel",
          entityType: "staff_application",
          entityId: data.id,
        });
      } catch (err) {
        console.error("Vendor notification failed:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vendor application error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit" },
      { status: 500 }
    );
  }
}
