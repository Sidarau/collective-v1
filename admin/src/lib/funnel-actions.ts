"use server";

import * as crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import { sendMagicLinkEmail, sendTrackedEmail } from "@core/email";
import { mintMagicLink } from "@core/invites";
import { config } from "@core/config";
import { getSettingValue, setSetting } from "@core/settings";
import type {
  ReferralLinkKind,
  ScreeningWindowRow,
  StaffApplicationRow,
} from "@core/database.types";
import { getAdminUser } from "./auth";

const db = getSupabaseAdmin;

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized");
  return admin;
}

function backTo(path: string, error?: string): never {
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ---------------------------------------------------------------- Referral links

export async function createReferralLinkAction(formData: FormData) {
  const admin = await requireAdmin();
  const label = str(formData, "label");
  const kind = (str(formData, "kind") === "vendor" ? "vendor" : "member") as ReferralLinkKind;
  if (!label) backTo("/referrals", "Give the link a label");

  const explicit = str(formData, "code").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const code = explicit || crypto.randomBytes(4).toString("hex");
  const maxUses = parseInt(str(formData, "maxUses"), 10);

  try {
    const { data, error } = await db()
      .from("referral_links")
      .insert({
        code,
        kind,
        label,
        note: str(formData, "note") || null,
        max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
        expires_at: str(formData, "expiresAt") || null,
        created_by: admin.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Create failed");

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "referral_link.create",
      entityType: "referral_link",
      entityId: data.id,
      summary: `Opened ${kind} door "${label}" (/${kind === "member" ? "r" : "v"}/${code})`,
    });
  } catch (err) {
    backTo("/referrals", err instanceof Error ? err.message : "Create failed");
  }
  revalidatePath("/referrals");
  backTo("/referrals");
}

export async function toggleReferralLinkAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const active = str(formData, "active") === "true";

  await db().from("referral_links").update({ active }).eq("id", id);
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: active ? "referral_link.open" : "referral_link.close",
    entityType: "referral_link",
    entityId: id,
    summary: active ? "Door reopened" : "Door closed",
  });
  revalidatePath("/referrals");
  backTo("/referrals");
}

export async function createReturningMemberInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const email = str(formData, "email").toLowerCase();
  const phone = str(formData, "phone");
  const whatsapp = str(formData, "whatsapp");
  const note = str(formData, "note");

  if (!firstName || !lastName || !email) {
    backTo("/referrals", "First name, last name, and email are required");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    backTo("/referrals", "That email doesn't look right");
  }
  if (!phone && !whatsapp) {
    backTo("/referrals", "Add a phone or WhatsApp number for the private profile");
  }

  let userId = "";
  try {
    const supabase = db();
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .upsert(
        {
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          whatsapp: whatsapp || null,
          source: "past_guest_fast_track",
          status: "active",
          notes: note || null,
        },
        { onConflict: "email" }
      )
      .select("id")
      .single();
    if (leadError || !lead) throw new Error(leadError?.message || "Failed to save lead");

    const phoneForLogin = phone || whatsapp || null;
    const { data: existing } = await supabase
      .from("users")
      .select("id, lead_id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      userId = existing.id;
      const { error } = await supabase
        .from("users")
        .update({
          role: "member",
          lead_id: existing.lead_id || lead.id,
          password_hash: null,
          phone: phoneForLogin,
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabase
        .from("users")
        .insert({
          email,
          role: "member",
          lead_id: lead.id,
          password_hash: null,
          phone: phoneForLogin,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "Failed to create member");
      userId = created.id;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          whatsapp: whatsapp || null,
          onboarding_completed: false,
          visibility: "members",
        },
        { onConflict: "user_id" }
      );
    if (profileError) throw new Error(profileError.message);

    if (note) {
      await supabase.from("admin_notes").insert({
        author_id: admin.id,
        author_email: admin.email,
        entity_type: "user",
        entity_id: userId,
        body: note,
      });
    }

    const link = await mintMagicLink(userId, email, config.baseUrl);
    await sendMagicLinkEmail({
      to: email,
      firstName,
      magicLink: link,
      intro:
        "You have been fast-tracked from a past stay. Use this private link to choose a password and fill the profile other members will see.",
      cta: "Set password and profile",
      template: "past_guest_fast_track",
      entityType: "user",
      entityId: userId,
      actorId: admin.id,
    });

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "member.fast_track",
      entityType: "user",
      entityId: userId,
      summary: `Fast-tracked past guest ${firstName} ${lastName} as a member`,
    });
  } catch (err) {
    backTo("/referrals", err instanceof Error ? err.message : "Could not create fast-track invite");
  }

  revalidatePath("/referrals");
  revalidatePath("/people");
  backTo(`/people/${userId}`);
}

// ---------------------------------------------------------------- Screening windows

export async function addScreeningWindowAction(formData: FormData) {
  const admin = await requireAdmin();
  const mode = str(formData, "mode"); // weekly | date
  const start = str(formData, "start"); // HH:MM
  const end = str(formData, "end");
  const toMinute = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };
  const startMinute = toMinute(start);
  const endMinute = toMinute(end);
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) {
    backTo("/schedule", "Give the block a valid start and end time");
  }

  const weekdays = formData.getAll("weekday").map(Number).filter((d) => d >= 0 && d <= 6);
  const date = str(formData, "date");
  if (mode === "weekly" && !weekdays.length) backTo("/schedule", "Pick at least one weekday");
  if (mode === "date" && !date) backTo("/schedule", "Pick a date");

  const kindRaw = str(formData, "kind");
  const kind = (["member", "vendor", "both"].includes(kindRaw) ? kindRaw : "both") as
    | "member"
    | "vendor"
    | "both";

  try {
    const rows: Partial<ScreeningWindowRow>[] =
      mode === "weekly"
        ? weekdays.map((weekday) => ({
            kind,
            weekday,
            date: null,
            start_minute: startMinute,
            end_minute: endMinute,
          }))
        : [{ kind, weekday: null, date, start_minute: startMinute, end_minute: endMinute }];
    const { error } = await db().from("screening_windows").insert(rows);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "screening_window.create",
      entityType: "screening_call",
      summary: `Host blocks added: ${mode === "weekly" ? `weekdays ${weekdays.join(",")}` : date} ${start}–${end} (${kind})`,
    });
  } catch (err) {
    backTo("/schedule", err instanceof Error ? err.message : "Could not add the block");
  }
  revalidatePath("/schedule");
  backTo("/schedule");
}

export async function toggleScreeningWindowAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const active = str(formData, "active") === "true";
  await db().from("screening_windows").update({ active }).eq("id", id);
  revalidatePath("/schedule");
  backTo("/schedule");
}

export async function deleteScreeningWindowAction(formData: FormData) {
  await requireAdmin();
  await db().from("screening_windows").delete().eq("id", str(formData, "id"));
  revalidatePath("/schedule");
  backTo("/schedule");
}

// ---------------------------------------------------------------- Calls

export async function setCallStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const raw = str(formData, "status");
  const path = str(formData, "path") || "/schedule";
  const status = ["completed", "no_show", "cancelled", "scheduled"].includes(raw)
    ? (raw as "completed" | "no_show" | "cancelled" | "scheduled")
    : null;
  if (!status) backTo(path, "Unknown call status");

  const { data: call } = await db().from("screening_calls").select("*").eq("id", id).maybeSingle();
  if (!call) backTo(path, "Call not found");

  await db()
    .from("screening_calls")
    .update({ status, notes: str(formData, "note") || call.notes })
    .eq("id", id);

  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: `screening.${status}`,
    entityType: "screening_call",
    entityId: id,
    summary: `${call.prospect_name} — call marked ${status.replaceAll("_", " ")}`,
  });
  revalidatePath(path);
  revalidatePath("/schedule");
  backTo(path);
}

// ---------------------------------------------------------------- Member scheduling links

/** Mint (if needed) and email the screening scheduler link for an application. */
export async function sendSchedulingLinkAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const path = `/applications/${id}`;

  const { data: app } = await db().from("applications").select("*").eq("id", id).maybeSingle();
  if (!app) backTo("/applications", "Application not found");

  try {
    let token = app.screening_token as string | null;
    if (!token) {
      token = crypto.randomBytes(24).toString("hex");
      await db().from("applications").update({ screening_token: token }).eq("id", id);
    }
    const url = `${config.baseUrl}/screening/${token}`;
    await sendTrackedEmail({
      to: app.email,
      subject: "Choose your fifteen minutes with the host",
      heading: `Dear ${app.first_name},`,
      body: "Your introduction is with the Circle. Next: a short call with the host — choose a window that suits you.",
      ctaHref: url,
      ctaLabel: "Schedule the call",
      template: "screening_invite",
      entityType: "application",
      entityId: id,
      actorId: admin.id,
      meta: { scheduling_url: url },
    });
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "application.scheduling_link_sent",
      entityType: "application",
      entityId: id,
      summary: `Scheduling link sent to ${app.email}`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Could not send the link");
  }
  revalidatePath(path);
  backTo(path);
}

// ---------------------------------------------------------------- Vendor funnel

const VENDOR_TRANSITIONS: Record<string, { status: StaffApplicationRow["status"]; label: string }> = {
  review: { status: "review", label: "moved to review" },
  interviewed: { status: "interviewed", label: "marked interviewed" },
  shortlist: { status: "shortlisted", label: "shortlisted" },
  hire: { status: "hired", label: "hired" },
  reject: { status: "rejected", label: "rejected" },
  reopen: { status: "submitted", label: "reopened" },
};

export async function vendorTransitionAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const op = str(formData, "op");
  const notify = str(formData, "notify") === "on";
  const path = `/vendors/${id}`;

  const transition = VENDOR_TRANSITIONS[op];
  if (!transition) backTo(path, "Unknown action");

  const { data: vendor } = await db().from("staff_applications").select("*").eq("id", id).maybeSingle();
  if (!vendor) backTo("/vendors", "Application not found");

  try {
    await db().from("staff_applications").update({ status: transition.status }).eq("id", id);

    if (notify && (op === "reject" || op === "hire")) {
      const copy =
        op === "hire"
          ? {
              subject: `Welcome to the house — ${config.brandName}`,
              body: `Good news, ${vendor.name.split(" ")[0]} — the house would like to work with you for ${vendor.role_applied}. We'll be in touch with the practical details shortly.`,
            }
          : {
              subject: `About your application to ${config.brandName}`,
              body: `Thank you for offering your hands to the house. We won't be moving forward for ${vendor.role_applied} right now — but seasons change, and we keep every application.`,
            };
      await sendTrackedEmail({
        to: vendor.email,
        heading: `Dear ${vendor.name.split(" ")[0]},`,
        ...copy,
        template: `vendor_${op}`,
        entityType: "staff_application",
        entityId: id,
        actorId: admin.id,
      });
    }

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: `staff_application.${transition.status}`,
      entityType: "staff_application",
      entityId: id,
      summary: `${vendor.name} (${vendor.role_applied}) ${transition.label}${notify ? " (notified)" : ""}`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Action failed");
  }
  revalidatePath(path);
  revalidatePath("/vendors");
  backTo(path);
}

/** Prescreen passed → mint interview token + email the scheduling link. */
export async function inviteVendorToInterviewAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const path = `/vendors/${id}`;

  const { data: vendor } = await db().from("staff_applications").select("*").eq("id", id).maybeSingle();
  if (!vendor) backTo("/vendors", "Application not found");

  try {
    let token = vendor.interview_token as string | null;
    if (!token) {
      token = crypto.randomBytes(24).toString("hex");
      await db().from("staff_applications").update({ interview_token: token }).eq("id", id);
    }
    if (vendor.status === "submitted") {
      await db().from("staff_applications").update({ status: "review" }).eq("id", id);
    }
    const url = `${config.baseUrl}/screening/${token}`;
    await sendTrackedEmail({
      to: vendor.email,
      subject: `An interview with ${config.brandName}`,
      heading: `Dear ${vendor.name.split(" ")[0]},`,
      body: `Your application for ${vendor.role_applied} caught our eye. Next step: fifteen minutes with the host — choose a window that suits you.`,
      ctaHref: url,
      ctaLabel: "Choose your time",
      template: "vendor_interview_invite",
      entityType: "staff_application",
      entityId: id,
      actorId: admin.id,
      meta: { scheduling_url: url },
    });
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "staff_application.interview_invited",
      entityType: "staff_application",
      entityId: id,
      summary: `${vendor.name} invited to interview (${vendor.role_applied})`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Could not send the invite");
  }
  revalidatePath(path);
  revalidatePath("/vendors");
  backTo(path);
}

// ---------------------------------------------------------------- Phone / WhatsApp invites

const PHONE_RE = /^\+[1-9]\d{6,14}$/;

/**
 * Invite someone Alex/Don only has a number for. Creates a one-time
 * /welcome/[token] link on the member app — returning guests become members
 * instantly there (no application, no screening); prospects flow into /join.
 * The link is meant to be pasted into WhatsApp (share button on the page).
 */
export async function createPhoneInviteAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");

  const rawPhone = (formData.get("phone") as string | null)?.replace(/[\s\-()]/g, "") || "";
  const kindRaw = (formData.get("kind") as string | null) || "member_returning";
  const kind = kindRaw === "member_new" ? "member_new" : "member_returning";
  const firstName = (formData.get("firstName") as string | null)?.trim() || null;
  const lastName = (formData.get("lastName") as string | null)?.trim() || null;
  const note = (formData.get("note") as string | null)?.trim() || null;

  if (!PHONE_RE.test(rawPhone)) {
    backTo("/referrals", "Phone must be international format, e.g. +34600123456");
  }

  const supabase = getSupabaseAdmin();
  const { data: taken } = await supabase.from("users").select("id").eq("phone", rawPhone).maybeSingle();
  if (taken) backTo("/referrals", "That number is already linked to an account — use People → mint entrance link instead");

  const token = crypto.randomBytes(18).toString("base64url");
  const { error } = await supabase.from("invite_tokens").insert({
    token,
    kind,
    phone: rawPhone,
    first_name: firstName,
    last_name: lastName,
    note,
    created_by: admin.id,
    expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
  });
  if (error) backTo("/referrals", error.message);

  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "invite.phone_created",
    entityType: "lead",
    entityId: null,
    summary: `WhatsApp ${kind === "member_returning" ? "returning-member" : "prospect"} invite for ${firstName || "someone"} (${rawPhone})`,
  });

  revalidatePath("/referrals");
  backTo("/referrals");
}

export async function expirePhoneInviteAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  const id = (formData.get("id") as string | null) || "";
  await getSupabaseAdmin()
    .from("invite_tokens")
    .update({ expires_at: new Date(0).toISOString() })
    .eq("id", id)
    .is("used_at", null);
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "invite.phone_expired",
    entityType: "lead",
    entityId: null,
    summary: "Expired a WhatsApp invite link",
  });
  revalidatePath("/referrals");
  backTo("/referrals");
}

// ---------------------------------------------------------------- Calendar feed

/**
 * Personal ICS feed token (Google Calendar connector). Created on demand,
 * rotated on request — rotation invalidates the old URL immediately.
 */
export async function ensureCalendarFeedAction() {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  const key = `calendar_feed:${admin.id}`;
  const existing = await getSettingValue<string>(key);
  if (!existing) {
    await setSetting(key, crypto.randomBytes(24).toString("base64url"), admin.id);
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "schedule.feed_created",
      entityType: "user",
      entityId: admin.id,
      summary: "Created a personal calendar feed link",
    });
  }
  revalidatePath("/schedule");
  backTo("/schedule");
}

export async function rotateCalendarFeedAction() {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  await setSetting(`calendar_feed:${admin.id}`, crypto.randomBytes(24).toString("base64url"), admin.id);
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "schedule.feed_rotated",
    entityType: "user",
    entityId: admin.id,
    summary: "Rotated their calendar feed link (old URL is dead)",
  });
  revalidatePath("/schedule");
  backTo("/schedule");
}
