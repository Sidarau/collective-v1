import * as crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { sendNotificationEmail } from "@core/email";
import { writeAudit } from "@core/audit";
import { isToggleEnabled } from "@core/settings";
import { config } from "@core/config";
import { mergeLabels } from "@core/labels";
import { mintSession } from "@core/session";
import { loadActiveReferralLink } from "@/lib/screening";
import type { ApplicationRow, ReferralLinkRow } from "@core/database.types";

export const runtime = "nodejs";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidPastOrPresentDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  );
}

/**
 * Public entrance via referral link — the front door of the funnel.
 * No session required: the link itself is the invitation.
 *
 * member doors: lead + user (role lead) + application with a one-purpose
 * screening token, then straight to the host-call scheduler.
 * instant doors: member account on the spot (investor decks, QR cards) —
 * session minted here, next stop /setup-password. No application, no call.
 * Both stamp the door's CRM labels onto the person.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;

    // Honeypot: bots fill everything. Pretend success, write nothing.
    if (clean(body.website)) return NextResponse.json({ success: true });

    const link = await loadActiveReferralLink(code, ["member", "instant_member"]);
    if (!link) {
      return NextResponse.json({ error: "This door is no longer open." }, { status: 404 });
    }

    if (link.kind === "instant_member") return instantEntrance(link, body);
    return memberApplication(link, body);
  } catch (error) {
    console.error("Referral entrance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit" },
      { status: 500 }
    );
  }
}

/** Merge the door's labels onto a lead + user pair (read-merge-write; tiny volumes). */
async function stampLabels(linkLabels: string[], leadId: string | null, userId: string | null) {
  if (!linkLabels.length) return;
  const supabase = getSupabaseAdmin();
  if (leadId) {
    const { data } = await supabase.from("leads").select("labels").eq("id", leadId).maybeSingle();
    await supabase
      .from("leads")
      .update({ labels: mergeLabels(data?.labels, linkLabels) })
      .eq("id", leadId);
  }
  if (userId) {
    const { data } = await supabase.from("users").select("labels").eq("id", userId).maybeSingle();
    await supabase
      .from("users")
      .update({ labels: mergeLabels(data?.labels, linkLabels) })
      .eq("id", userId);
  }
}

async function memberApplication(link: ReferralLinkRow, body: Record<string, unknown>) {
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
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }
  const birthday = DATE_RE.test(clean(body.birthday)) ? clean(body.birthday) : null;

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
        birthday,
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

  await stampLabels(link.labels || [], lead.id, userId);

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
      birthday,
      status: "submitted",
      screening_token: screeningToken,
      referral_link_id: link.id,
    })
    .select("id")
    .single();
  if (appError || !application) throw new Error(appError?.message || "Failed to save application");

  await getSupabaseAdmin()
    .from("referral_links")
    .update({ use_count: link.use_count + 1 })
    .eq("id", link.id);

  const app = application as Pick<ApplicationRow, "id">;
  await writeAudit({
    action: "application.submitted",
    entityType: "application",
    entityId: app.id,
    summary: `${firstName} ${lastName} applied via referral link "${link.label}"`,
    meta: { referral_code: link.code, labels: link.labels || [] },
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
}

async function instantEntrance(link: ReferralLinkRow, body: Record<string, unknown>) {
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone);
  const birthday = clean(body.birthday);
  if (!firstName || !lastName || !email || !phone || !birthday) {
    return NextResponse.json(
      { error: "Name, email, phone, and birthday are required." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }
  if (!isValidPastOrPresentDate(birthday)) {
    return NextResponse.json({ error: "Enter a valid birthday." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existingUser } = await supabase
    .from("users")
    .select("id, email, role, lead_id, phone")
    .eq("email", email)
    .maybeSingle();
  if (existingUser && existingUser.role !== "lead") {
    return NextResponse.json(
      { error: "You already belong to the Circle — sign in instead.", redirect: "/login" },
      { status: 409 }
    );
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .upsert(
      {
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        whatsapp: phone,
        birthday,
        source: `referral_link:${link.code}`,
        status: "active",
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();
  if (leadError || !lead) throw new Error(leadError?.message || "Failed to create lead");

  let user = existingUser;
  if (existingUser) {
    const { data: updated } = await supabase
      .from("users")
      .update({ role: "member", lead_id: existingUser.lead_id || lead.id, phone: existingUser.phone || phone })
      .eq("id", existingUser.id)
      .select("id, email, role, lead_id, phone")
      .single();
    user = updated || existingUser;
  } else {
    const { data: created, error: userError } = await supabase
      .from("users")
      .insert({ email, role: "member", lead_id: lead.id, phone })
      .select("id, email, role, lead_id, phone")
      .single();
    if (userError || !created) throw new Error(userError?.message || "Account creation failed");
    user = created;
  }

  // Instant doors collect the minimum complete profile up front. Mark it
  // complete so password setup hands the authenticated member straight to
  // the platform instead of sending them through the longer onboarding form.
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user!.id,
      first_name: firstName,
      last_name: lastName,
      phone,
      whatsapp: phone,
      birthday,
      onboarding_completed: true,
      visibility: "members",
    },
    { onConflict: "user_id" }
  );
  if (profileError) throw new Error(profileError.message);

  await stampLabels(link.labels || [], lead.id, user!.id);

  await supabase
    .from("referral_links")
    .update({ use_count: link.use_count + 1 })
    .eq("id", link.id);

  await writeAudit({
    action: "referral.instant_member",
    entityType: "user",
    entityId: user!.id,
    summary: `${firstName} ${lastName} entered instantly via door "${link.label}"`,
    meta: { referral_code: link.code, labels: link.labels || [] },
  });

  if (config.adminEmail && (await isToggleEnabled("notify.admin_on_application"))) {
    try {
      await sendNotificationEmail({
        to: config.adminEmail,
        subject: `Instant entrance: ${firstName} ${lastName}`,
        heading: "Someone stepped inside",
        body: `${firstName} ${lastName} (${email}) became a member through the instant door "${link.label}"${(link.labels || []).length ? ` — labelled ${(link.labels || []).join(", ")}` : ""}.`,
        ctaHref: config.adminUrl || undefined,
        ctaLabel: "Open console",
        entityType: "user",
        entityId: user!.id,
      });
    } catch (err) {
      console.error("Admin notification failed:", err);
    }
  }

  const minted = await mintSession(user!);
  const res = NextResponse.json({ success: true, destination: "/setup-password" });
  res.cookies.set({ name: minted.cookie.name, value: minted.sessionJwt, ...minted.cookie.options });
  return res;
}
