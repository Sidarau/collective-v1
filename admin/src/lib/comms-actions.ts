"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import { sendTrackedEmail } from "@core/email";
import type { EmailCampaignRow, Json } from "@core/database.types";
import { resolveCampaignRecipients, type CampaignAudience } from "./funnel-data";
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

const fill = (template: string, firstName: string) =>
  template.replaceAll("{firstName}", firstName);

export async function saveCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const backPath = id ? `/communications/campaigns/${id}` : "/communications";
  if (!name) backTo(backPath, "Give the campaign a name");

  const audience: CampaignAudience = {
    roles: formData.getAll("roles").map(String).filter(Boolean),
  };

  const payload = {
    name,
    subject: str(formData, "subject"),
    heading: str(formData, "heading"),
    body_md: String(formData.get("body") ?? "").trim(),
    cta_href: str(formData, "ctaHref") || null,
    cta_label: str(formData, "ctaLabel") || null,
    audience: audience as unknown as Json,
  };

  let campaignId = id;
  try {
    if (id) {
      const { data: existing } = await db().from("email_campaigns").select("status").eq("id", id).maybeSingle();
      if (existing?.status !== "draft") backTo(backPath, "Only drafts can be edited");
      const { error } = await db().from("email_campaigns").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db()
        .from("email_campaigns")
        .insert({ ...payload, status: "draft", created_by: admin.id })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message || "Create failed");
      campaignId = data.id;
    }
  } catch (err) {
    backTo(backPath, err instanceof Error ? err.message : "Save failed");
  }
  revalidatePath("/communications");
  revalidatePath(`/communications/campaigns/${campaignId}`);
  backTo(`/communications/campaigns/${campaignId}`);
}

/**
 * Send a draft to its audience through the outbox: suppression-checked per
 * recipient, delivered only when EMAIL_MODE=send — in log mode this writes
 * rows so the whole campaign is reviewable before anything real goes out.
 */
export async function sendCampaignAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const path = `/communications/campaigns/${id}`;
  if (str(formData, "confirm") !== "on") backTo(path, "Tick the confirmation first");

  const { data: campaign } = await db().from("email_campaigns").select("*").eq("id", id).maybeSingle();
  if (!campaign) backTo("/communications", "Campaign not found");
  const row = campaign as EmailCampaignRow;
  if (row.status !== "draft") backTo(path, "This campaign has already been sent");
  if (!row.subject || !row.body_md) backTo(path, "Subject and body are required before sending");

  try {
    const recipients = await resolveCampaignRecipients((row.audience || {}) as CampaignAudience);
    if (!recipients.length) backTo(path, "The audience is empty");

    await db()
      .from("email_campaigns")
      .update({ status: "sending", total_recipients: recipients.length })
      .eq("id", id);

    let sent = 0;
    for (const recipient of recipients) {
      const result = await sendTrackedEmail({
        to: recipient.email,
        subject: fill(row.subject, recipient.firstName),
        heading: fill(row.heading || `Dear ${recipient.firstName},`, recipient.firstName),
        body: fill(row.body_md, recipient.firstName),
        ctaHref: row.cta_href || undefined,
        ctaLabel: row.cta_label || undefined,
        template: `campaign:${row.name}`,
        entityType: "campaign",
        entityId: id,
        actorId: admin.id,
      });
      if (!result.suppressed && result.status !== "failed") sent += 1;
    }

    await db()
      .from("email_campaigns")
      .update({ status: "sent", sent_count: sent, sent_at: new Date().toISOString() })
      .eq("id", id);

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "campaign.send",
      entityType: "campaign",
      entityId: id,
      summary: `Campaign "${row.name}" → ${sent}/${recipients.length} recipients (outbox)`,
      meta: { recipients: recipients.length, sent },
    });
  } catch (err) {
    await db().from("email_campaigns").update({ status: "draft" }).eq("id", id);
    backTo(path, err instanceof Error ? err.message : "Send failed");
  }
  revalidatePath(path);
  revalidatePath("/communications");
  backTo(path);
}
