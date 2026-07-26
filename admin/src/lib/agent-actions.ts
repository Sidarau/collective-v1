"use server";

import * as crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import { getAdminUser } from "./auth";
import { hashAgentToken } from "./agent-auth";
import { grantCalendarToAgent } from "@core/calendar-actions";
import type { AgentTokenScope } from "@core/database.types";
import { mintCalendarOAuthInvite } from "@core/calendar-onboarding";
import { config } from "@core/config";
import { updateGoogleSourceSelection } from "@core/google-calendar";

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
  const rawScope = (formData.get("scope") as string | null) || "assistant";
  const scope: AgentTokenScope = ["owner", "assistant", "staff", "member"].includes(rawScope)
    ? (rawScope as AgentTokenScope)
    : "assistant";

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
    scope,
  });
  if (error) backTo("/agents", error.message);

  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "agent_token.mint",
    entityType: "user",
    entityId: admin.id,
    summary: `Minted ${scope} agent token "${label}"`,
  });

  revalidatePath("/agents");
  // Shown exactly once; the page strips the query from history after render.
  redirect(`/agents?minted=${token}&label=${encodeURIComponent(label)}`);
}

/** Calendar grants are explicit per token and per calendar. */
export async function updateAgentCalendarGrantsAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  const tokenId = (formData.get("tokenId") as string | null) || "";
  const selected = formData
    .getAll("calendarSourceId")
    .filter((value): value is string => typeof value === "string");
  const supabase = getSupabaseAdmin();
  const { data: token } = await supabase
    .from("agent_tokens")
    .select("id, admin_id, label, revoked_at")
    .eq("id", tokenId)
    .maybeSingle();
  if (!token || token.admin_id !== admin.id || token.revoked_at) {
    backTo("/agents", "Choose one of your active agent tokens");
  }
  try {
    let connectionRequest = supabase
      .from("google_calendar_connections")
      .select("id, admin_id");
    if (admin.role !== "admin") connectionRequest = connectionRequest.eq("admin_id", admin.id);
    const { data: connections } = await connectionRequest;
    const connectionIds = (connections || []).map((row) => row.id);
    const { data: sources } = connectionIds.length
      ? await supabase
          .from("google_calendar_sources")
          .select("id")
          .in("connection_id", connectionIds)
      : { data: [] };
    const allowed = new Set((sources || []).map((row) => row.id));
    const wanted = selected.filter((id) => allowed.has(id));
    const sourceIds = [...allowed];
    if (sourceIds.length) {
      await supabase
        .from("agent_calendar_grants")
        .delete()
        .eq("agent_token_id", tokenId)
        .in("source_id", sourceIds);
    }
    for (const sourceId of wanted) {
      await grantCalendarToAgent({
        approvedBy: admin.id,
        tokenId,
        sourceId,
        detailLevel: "details",
        canRequestWrites: true,
        // Collecta always asks before writes in the Don MVP.
        lowRiskAutoexecute: false,
      });
    }
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "agent.calendar_grants_updated",
      entityType: "user",
      entityId: admin.id,
      summary: `Granted "${token.label}" access to ${wanted.length} calendar${wanted.length === 1 ? "" : "s"}`,
      meta: { token_id: tokenId, source_ids: wanted },
    });
  } catch (error) {
    backTo("/agents", error instanceof Error ? error.message : "Could not save calendar access");
  }
  revalidatePath("/agents");
  backTo("/agents");
}

/** Owner-admin chooses calendars for any connected operator; operators choose their own. */
export async function updateConnectedOperatorCalendarsAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  const targetAdminId = (formData.get("targetAdminId") as string | null) || "";
  if (admin.role !== "admin" && targetAdminId !== admin.id) {
    backTo("/agents", "You can only choose your own calendars");
  }
  const selected = formData
    .getAll("calendarSourceId")
    .filter((value): value is string => typeof value === "string");
  try {
    await updateGoogleSourceSelection(targetAdminId, selected);
  } catch (error) {
    backTo("/agents", error instanceof Error ? error.message : "Could not save calendars");
  }
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "calendar.operator_sources_updated",
    entityType: "user",
    entityId: targetAdminId,
    summary: `Selected ${selected.length} calendar${selected.length === 1 ? "" : "s"} for shared assistant access`,
  });
  revalidatePath("/agents");
  backTo("/agents");
}

/** Create the one link a non-technical operator needs to connect Google. */
export async function mintCalendarSetupLinkAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) backTo("/login");
  const targetAdminId = (formData.get("targetAdminId") as string | null) || admin.id;
  const { data: target } = await getSupabaseAdmin()
    .from("users")
    .select("id, email, role")
    .eq("id", targetAdminId)
    .maybeSingle();
  if (!target || !["admin", "operator"].includes(target.role)) {
    backTo("/agents", "Calendar setup links are only for operators");
  }
  if (admin.role !== "admin" && target.id !== admin.id) {
    backTo("/agents", "Only an admin can prepare another operator's setup link");
  }
  const token = await mintCalendarOAuthInvite({
    adminId: target.id,
    createdBy: admin.id,
  });
  const link = `${config.adminUrl || "https://opencollective.app"}/api/google/oauth/start?setup=${encodeURIComponent(token)}`;
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "calendar.oauth_invite_minted",
    entityType: "user",
    entityId: target.id,
    summary: `Prepared a one-time Google Calendar setup link for ${target.email}`,
  });
  redirect(
    `/agents?calendarSetup=${encodeURIComponent(link)}&target=${encodeURIComponent(target.email)}`
  );
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
