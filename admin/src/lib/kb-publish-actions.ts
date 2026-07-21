"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import { getKbNode } from "@core/kb";
import { createRevision, publishRevision } from "@core/kb-revisions";
import { createShare, revokeShare } from "@core/kb-shares";
import { authorize } from "@core/policy";
import type { KbAudience, KbTemplateName } from "@core/database.types";
import type { Principal } from "@core/policy";
import { getAdminUser } from "./auth";

async function requireOperator(): Promise<Principal & { email: string }> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized");
  return { kind: "operator", userId: admin.id, entityId: null, via: "session", tokenId: null, email: admin.email };
}

const str = (f: FormData, k: string) => (typeof f.get(k) === "string" ? String(f.get(k)).trim() : "");
const back = (id: string, error?: string): never =>
  redirect(error ? `/kb/${id}?error=${encodeURIComponent(error)}` : `/kb/${id}`);

/** Render the node's current markdown into an immutable revision and publish it. Human only. */
export async function publishNodeAction(formData: FormData) {
  const op = await requireOperator();
  const id = str(formData, "id");
  const template = (["article", "brief", "deck"].includes(str(formData, "template"))
    ? str(formData, "template")
    : "article") as KbTemplateName;
  const accent = str(formData, "accent");

  if (!authorize(op, "kb.publish", { treeGranted: true }).allow) back(id, "Not permitted");
  const node = await getKbNode(id);
  if (!node) back(id, "Node not found");
  if (node!.kind !== "doc") back(id, "Only docs can be published");
  if (!node!.body_md.trim()) back(id, "Nothing to publish — add content first");

  try {
    const rev = await createRevision({
      nodeId: id,
      markdown: node!.body_md,
      template,
      theme: accent ? { accent } : {},
      authorId: op.userId,
      authorEmail: op.email,
    });
    await publishRevision(id, rev.id);
    await writeAudit({
      actorId: op.userId,
      actorEmail: op.email,
      action: "kb.publish",
      entityType: "kb_node" as never,
      entityId: id,
      summary: `Published ${template} revision ${rev.id.slice(0, 8)} of "${node!.title}"`,
    });
  } catch (err) {
    back(id, err instanceof Error ? err.message : "Publish failed");
  }
  revalidatePath(`/kb/${id}`);
  back(id);
}

/** Toggle a tree grant (audience allow) on a node. Human only. */
export async function setGrantAction(formData: FormData) {
  const op = await requireOperator();
  const id = str(formData, "id");
  const audience = str(formData, "audience") as KbAudience;
  const on = str(formData, "on") === "true";
  if (!["operator", "staff", "member", "vendor"].includes(audience)) back(id, "Bad audience");
  if (!authorize(op, "kb.grant", { treeGranted: true }).allow) back(id, "Not permitted");

  const db = getSupabaseAdmin();
  if (on) {
    await db.from("kb_grants").upsert(
      { node_id: id, audience, effect: "allow", created_by: op.userId },
      { onConflict: "node_id,audience" }
    );
  } else {
    await db.from("kb_grants").delete().eq("node_id", id).eq("audience", audience);
  }
  await writeAudit({
    actorId: op.userId,
    actorEmail: op.email,
    action: on ? "kb.grant.add" : "kb.grant.remove",
    entityType: "kb_node" as never,
    entityId: id,
    summary: `${on ? "Granted" : "Removed"} ${audience} access`,
  });
  revalidatePath(`/kb/${id}`);
  back(id);
}

export interface ShareResult {
  ok: boolean;
  error?: string;
  url?: string;
  password?: string;
  recipient?: string;
}

/** Create an external share of the node's published revision. Returns one-time creds. Human only. */
export async function createShareAction(_prev: ShareResult, formData: FormData): Promise<ShareResult> {
  const op = await requireOperator();
  const id = str(formData, "id");
  if (!authorize(op, "kb.share", { treeGranted: true }).allow) return { ok: false, error: "Not permitted" };

  const node = await getKbNode(id);
  if (!node?.published_revision_id) {
    return { ok: false, error: "Publish this doc before sharing it." };
  }
  const recipient = str(formData, "recipient");
  if (!recipient) return { ok: false, error: "Name the recipient." };

  const days = parseInt(str(formData, "expiresDays"), 10);
  const maxViews = parseInt(str(formData, "maxViews"), 10);
  try {
    const { url, password } = await createShare({
      nodeId: id,
      revisionId: node.published_revision_id,
      recipientLabel: recipient,
      password: str(formData, "password") || undefined,
      watermark: str(formData, "watermark") === "on",
      expiresAt: Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 864e5).toISOString()
        : null,
      maxViews: Number.isFinite(maxViews) && maxViews > 0 ? maxViews : null,
      createdBy: op.userId,
    });
    await writeAudit({
      actorId: op.userId,
      actorEmail: op.email,
      action: "kb.share.create",
      entityType: "kb_node" as never,
      entityId: id,
      summary: `Created external share for "${node.title}" → ${recipient}`,
    });
    revalidatePath(`/kb/${id}`);
    return { ok: true, url, password, recipient };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Share failed" };
  }
}

export async function revokeShareAction(formData: FormData) {
  const op = await requireOperator();
  const id = str(formData, "id");
  const shareId = str(formData, "shareId");
  await revokeShare(shareId);
  await writeAudit({
    actorId: op.userId,
    actorEmail: op.email,
    action: "kb.share.revoke",
    entityType: "kb_node" as never,
    entityId: id,
    summary: `Revoked share ${shareId.slice(0, 8)}`,
  });
  revalidatePath(`/kb/${id}`);
  back(id);
}
