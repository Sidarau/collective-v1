"use server";

import * as crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import { getAdminUser } from "./auth";
import { hashAgentToken } from "./agent-auth";

const MAX_ACTIVE_TOKENS = 3;

function backTo(path: string, error?: string): never {
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

/** Mint a personal Operator OS token (osk_…). Shown once, stored as sha256. */
export async function mintAgentTokenAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  const label = (formData.get("label") as string | null)?.trim() || "";
  if (!label || label.length > 40) backTo("/agents", "Give the token a short label (e.g. 'claude-code')");

  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("agent_tokens")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", admin.id)
    .is("revoked_at", null);
  if ((count || 0) >= MAX_ACTIVE_TOKENS) {
    backTo("/agents", `You already have ${MAX_ACTIVE_TOKENS} active tokens — revoke one first`);
  }

  const token = `osk_${crypto.randomBytes(24).toString("hex")}`;
  const { error } = await supabase.from("agent_tokens").insert({
    admin_id: admin.id,
    label,
    token_hash: hashAgentToken(token),
    prefix: token.slice(0, 12),
  });
  if (error) backTo("/agents", error.message);

  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "agent_token.mint",
    entityType: "user",
    entityId: admin.id,
    summary: `Minted agent token "${label}"`,
  });

  revalidatePath("/agents");
  // Shown exactly once; the page strips the query from history after render.
  redirect(`/agents?minted=${token}&label=${encodeURIComponent(label)}`);
}

export async function revokeAgentTokenAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  const id = (formData.get("id") as string | null) || "";

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("agent_tokens")
    .select("id, admin_id, label")
    .eq("id", id)
    .maybeSingle();
  if (!row) backTo("/agents", "Token not found");
  if (row.admin_id !== admin.id) backTo("/agents", "You can only revoke your own tokens");

  await supabase
    .from("agent_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "agent_token.revoke",
    entityType: "user",
    entityId: admin.id,
    summary: `Revoked agent token "${row.label}"`,
  });

  revalidatePath("/agents");
  backTo("/agents");
}
