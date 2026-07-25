import * as crypto from "node:crypto";
import { writeAudit } from "./audit";
import type {
  AgentCalendarGrantRow,
  CalendarActionOperation,
  CalendarActionRequestRow,
  CalendarActionStatus,
  CalendarDetailLevel,
  GoogleCalendarSourceRow,
  Json,
} from "./database.types";
import {
  cancelGoogleCalendarEvent,
  createGoogleCalendarEvent,
  googleEventIdForIdempotencyKey,
  updateGoogleCalendarEvent,
  type GoogleEventInput,
} from "./google-calendar";
import { getSupabaseAdmin } from "./supabase";
import { calendarActionPreview, classifyCalendarActionRisk } from "./calendar-risk";

export { calendarActionPreview, classifyCalendarActionRisk } from "./calendar-risk";

export interface CalendarActionInput {
  sourceId: string;
  operation: CalendarActionOperation;
  eventId?: string;
  event: Partial<GoogleEventInput>;
  idempotencyKey: string;
}

export interface CalendarActionActor {
  tokenId: string | null;
  adminId: string | null;
  adminEmail?: string | null;
  tokenLabel?: string | null;
  human: boolean;
}

export interface CalendarGrantView {
  sourceId: string;
  calendarName: string;
  detailLevel: CalendarDetailLevel;
  canRead: boolean;
  canRequestWrites: boolean;
  lowRiskAutoexecute: boolean;
}

export interface CalendarActionRequestView extends CalendarActionRequestRow {
  calendarName: string;
  ownerEmail: string | null;
}

function validateCalendarAction(input: CalendarActionInput): void {
  if (!input.idempotencyKey.trim()) throw new Error("idempotencyKey is required");
  if (input.operation === "create") {
    if (!input.event.summary?.trim() || !input.event.startIso || !input.event.endIso) {
      throw new Error("Create requires summary, startIso, and endIso");
    }
    if (new Date(input.event.endIso) <= new Date(input.event.startIso)) {
      throw new Error("Calendar event must end after it starts");
    }
  } else if (!input.eventId) {
    throw new Error(`${input.operation} requires eventId`);
  }
}

async function sourceOwner(sourceId: string): Promise<{
  source: GoogleCalendarSourceRow;
  adminId: string;
}> {
  const db = getSupabaseAdmin();
  const { data: source, error } = await db
    .from("google_calendar_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error || !source) throw new Error(error?.message || "Calendar not found");
  const { data: connection } = await db
    .from("google_calendar_connections")
    .select("admin_id")
    .eq("id", source.connection_id)
    .single();
  if (!connection) throw new Error("Calendar owner not found");
  return { source: source as GoogleCalendarSourceRow, adminId: connection.admin_id };
}

export async function listCalendarGrantsForToken(
  tokenId: string
): Promise<CalendarGrantView[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("agent_calendar_grants")
    .select("*")
    .eq("agent_token_id", tokenId)
    .eq("can_read", true);
  if (error) throw new Error(error.message);
  const now = Date.now();
  const result: CalendarGrantView[] = [];
  for (const grant of (data as AgentCalendarGrantRow[]) || []) {
    if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) continue;
    const { data: source } = await getSupabaseAdmin()
      .from("google_calendar_sources")
      .select("summary")
      .eq("id", grant.source_id)
      .eq("selected", true)
      .maybeSingle();
    if (!source) continue;
    result.push({
      sourceId: grant.source_id,
      calendarName: source.summary,
      detailLevel: grant.detail_level,
      canRead: grant.can_read,
      canRequestWrites: grant.can_request_writes,
      lowRiskAutoexecute: grant.low_risk_autoexecute,
    });
  }
  return result;
}

export async function grantCalendarToAgent(input: {
  approvedBy: string;
  tokenId: string;
  sourceId: string;
  detailLevel: CalendarDetailLevel;
  canRequestWrites: boolean;
  lowRiskAutoexecute?: boolean;
  expiresAt?: string | null;
}): Promise<void> {
  const { adminId: ownerId } = await sourceOwner(input.sourceId);
  const { data: approver } = await getSupabaseAdmin()
    .from("users")
    .select("role")
    .eq("id", input.approvedBy)
    .single();
  if (!approver || (approver.role !== "admin" && ownerId !== input.approvedBy)) {
    throw new Error("Only an admin or the calendar owner may grant this calendar");
  }
  const { data: token } = await getSupabaseAdmin()
    .from("agent_tokens")
    .select("admin_id, revoked_at")
    .eq("id", input.tokenId)
    .single();
  if (
    !token ||
    token.revoked_at ||
    (approver.role !== "admin" && token.admin_id !== input.approvedBy)
  ) {
    throw new Error("Agent token is not active or cannot receive this grant");
  }
  const { error } = await getSupabaseAdmin().from("agent_calendar_grants").upsert(
    {
      agent_token_id: input.tokenId,
      source_id: input.sourceId,
      detail_level: input.detailLevel,
      can_read: true,
      can_request_writes: input.canRequestWrites,
      low_risk_autoexecute: Boolean(input.lowRiskAutoexecute),
      approved_by: input.approvedBy,
      expires_at: input.expiresAt || null,
    },
    { onConflict: "agent_token_id,source_id" }
  );
  if (error) throw new Error(error.message);
}

async function grantForAction(
  tokenId: string,
  sourceId: string
): Promise<AgentCalendarGrantRow | null> {
  const { data } = await getSupabaseAdmin()
    .from("agent_calendar_grants")
    .select("*")
    .eq("agent_token_id", tokenId)
    .eq("source_id", sourceId)
    .eq("can_request_writes", true)
    .maybeSingle();
  const grant = data as AgentCalendarGrantRow | null;
  if (!grant) return null;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now()) return null;
  return grant;
}

export async function requestCalendarAction(
  input: CalendarActionInput,
  actor: CalendarActionActor
): Promise<CalendarActionRequestRow> {
  validateCalendarAction(input);
  const db = getSupabaseAdmin();
  const { adminId: ownerId } = await sourceOwner(input.sourceId);
  let lowRiskAutoexecute = false;

  if (actor.human) {
    if (!actor.adminId || actor.adminId !== ownerId) {
      throw new Error("You can only change your own calendar");
    }
  } else {
    if (!actor.tokenId) throw new Error("An attributable agent token is required");
    const grant = await grantForAction(actor.tokenId, input.sourceId);
    if (!grant) throw new Error("This agent may not request changes to that calendar");
    lowRiskAutoexecute = grant.low_risk_autoexecute;
  }

  const { data: existing } = await db
    .from("calendar_action_requests")
    .select("*")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) return existing as CalendarActionRequestRow;

  const risk = classifyCalendarActionRisk(input.operation, input.event);
  const autoApprove = actor.human || (risk === "low" && lowRiskAutoexecute);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const { data, error } = await db
    .from("calendar_action_requests")
    .insert({
      requested_by_token_id: actor.tokenId,
      requested_by_admin_id: actor.adminId,
      source_id: input.sourceId,
      operation: input.operation,
      google_event_id: input.eventId || null,
      payload: input.event as Json,
      risk,
      status: autoApprove ? "approved" : "pending",
      idempotency_key: input.idempotencyKey,
      preview: calendarActionPreview(input),
      approved_by: autoApprove ? actor.adminId : null,
      approved_at: autoApprove ? now : null,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create calendar request");

  await writeAudit({
    actorId: actor.adminId,
    actorEmail: actor.adminEmail || "agent",
    action: "calendar.action_requested",
    entityType: "event",
    entityId: null,
    summary: `${actor.tokenLabel ? `[${actor.tokenLabel}] ` : ""}${data.preview}`,
    meta: {
      request_id: data.id,
      operation: input.operation,
      risk,
      source_id: input.sourceId,
    },
  });

  return autoApprove
    ? executeCalendarAction(data.id)
    : (data as CalendarActionRequestRow);
}

export async function approveCalendarAction(
  requestId: string,
  adminId: string
): Promise<CalendarActionRequestRow> {
  const { data: request } = await getSupabaseAdmin()
    .from("calendar_action_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) throw new Error("Calendar request not found");
  const { adminId: ownerId } = await sourceOwner(request.source_id);
  const { data: approver } = await getSupabaseAdmin()
    .from("users")
    .select("role")
    .eq("id", adminId)
    .single();
  if (!approver || (approver.role !== "admin" && ownerId !== adminId)) {
    throw new Error("Only an admin or the calendar owner may approve this request");
  }
  if (request.status !== "pending") return request as CalendarActionRequestRow;
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await getSupabaseAdmin()
      .from("calendar_action_requests")
      .update({ status: "expired" })
      .eq("id", requestId);
    throw new Error("This request expired");
  }
  const { data, error } = await getSupabaseAdmin()
    .from("calendar_action_requests")
    .update({
      status: "approved",
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not approve request");
  return data as CalendarActionRequestRow;
}

export async function denyCalendarAction(
  requestId: string,
  adminId: string
): Promise<CalendarActionRequestRow> {
  const { data: request } = await getSupabaseAdmin()
    .from("calendar_action_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) throw new Error("Calendar request not found");
  const { adminId: ownerId } = await sourceOwner(request.source_id);
  const { data: approver } = await getSupabaseAdmin()
    .from("users")
    .select("role")
    .eq("id", adminId)
    .single();
  if (!approver || (approver.role !== "admin" && ownerId !== adminId)) {
    throw new Error("Only an admin or the calendar owner may deny this request");
  }
  if (request.status !== "pending") return request as CalendarActionRequestRow;
  const { data, error } = await getSupabaseAdmin()
    .from("calendar_action_requests")
    .update({
      status: "denied",
      denied_by: adminId,
      denied_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not deny request");
  return data as CalendarActionRequestRow;
}

export async function executeCalendarAction(
  requestId: string
): Promise<CalendarActionRequestRow> {
  const db = getSupabaseAdmin();
  const { data: claimed, error } = await db
    .from("calendar_action_requests")
    .update({ status: "executing", error: null })
    .eq("id", requestId)
    .eq("status", "approved")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!claimed) {
    const { data: current } = await db
      .from("calendar_action_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (!current) throw new Error("Calendar request not found");
    return current as CalendarActionRequestRow;
  }

  const request = claimed as CalendarActionRequestRow;
  try {
    const event = request.payload as Partial<GoogleEventInput>;
    let result: Json = { ok: true };
    if (request.operation === "create") {
      result = (await createGoogleCalendarEvent(
        request.source_id,
        event as GoogleEventInput,
        googleEventIdForIdempotencyKey(request.idempotency_key)
      )) as unknown as Json;
    } else if (request.operation === "update") {
      result = (await updateGoogleCalendarEvent(
        request.source_id,
        request.google_event_id!,
        event
      )) as unknown as Json;
    } else {
      await cancelGoogleCalendarEvent(request.source_id, request.google_event_id!);
    }
    const { data } = await db
      .from("calendar_action_requests")
      .update({
        status: "executed",
        result,
        executed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "executing")
      .select("*")
      .single();
    return data as CalendarActionRequestRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar action failed";
    const { data } = await db
      .from("calendar_action_requests")
      .update({ status: "failed", error: message.slice(0, 500) })
      .eq("id", requestId)
      .eq("status", "executing")
      .select("*")
      .single();
    if (data) return data as CalendarActionRequestRow;
    throw error;
  }
}

export async function listCalendarActionRequests(
  adminId: string,
  statuses: CalendarActionStatus[] = ["pending", "approved", "failed"],
  includeAll = false
): Promise<CalendarActionRequestView[]> {
  let request = getSupabaseAdmin()
    .from("google_calendar_connections")
    .select("id, google_email");
  if (!includeAll) request = request.eq("admin_id", adminId);
  const { data: connections } = await request;
  const connectionIds = (connections || []).map((row) => row.id);
  if (!connectionIds.length) return [];
  const { data: sources } = await getSupabaseAdmin()
    .from("google_calendar_sources")
    .select("id, summary, connection_id")
    .in("connection_id", connectionIds);
  const sourceIds = (sources || []).map((row) => row.id);
  if (!sourceIds.length) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("calendar_action_requests")
    .select("*")
    .in("source_id", sourceIds)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const connectionEmail = new Map(
    (connections || []).map((connection) => [connection.id, connection.google_email])
  );
  const sourceInfo = new Map(
    (sources || []).map((source) => [
      source.id,
      {
        calendarName: source.summary,
        ownerEmail: connectionEmail.get(source.connection_id) || null,
      },
    ])
  );
  return ((data as CalendarActionRequestRow[]) || []).map((row) => ({
    ...row,
    calendarName: sourceInfo.get(row.source_id)?.calendarName || "Google Calendar",
    ownerEmail: sourceInfo.get(row.source_id)?.ownerEmail || null,
  }));
}

export function randomCalendarIdempotencyKey(prefix = "calendar"): string {
  return `${prefix}:${crypto.randomUUID()}`;
}
