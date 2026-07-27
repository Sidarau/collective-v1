import * as crypto from "node:crypto";
import { config } from "./config";
import { decryptCalendarSecret, encryptCalendarSecret, hashCalendarToken } from "./calendar-crypto";
import type {
  CalendarDetailLevel,
  CalendarEventLinkRow,
  GoogleCalendarConnectionRow,
  GoogleCalendarSourceRow,
} from "./database.types";
import { getSupabaseAdmin } from "./supabase";

/**
 * Google Calendar v2.
 *
 * The browser-facing OAuth flow is deliberately one button. Refresh tokens are
 * encrypted at rest, calendars are explicit resources, and Google push
 * notifications only trigger incremental sync — the webhook never trusts a
 * request body as calendar state.
 */

const LEGACY_SETTING_PREFIX = "gcal_oauth:";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const WATCH_TTL_SECONDS = 6 * 24 * 60 * 60;

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export interface GoogleConnection {
  id: string;
  adminId: string;
  email: string | null;
  connectedAt: string | null;
  active: boolean;
}

export interface GoogleCalendarSource extends GoogleCalendarSourceRow {
  adminId: string;
  googleEmail: string | null;
}

export interface BusyInterval {
  start: string;
  end: string;
}

export interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  startIso: string;
  endIso: string;
  attendees?: string[];
  timezone?: string;
}

export interface CalendarAgendaEvent {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  location?: string;
  start: string | null;
  end: string | null;
  attendees?: string[];
  htmlLink?: string;
}

interface GoogleCalendarListEntry {
  id: string;
  summary?: string;
  primary?: boolean;
  timeZone?: string;
  accessRole?: string;
  deleted?: boolean;
}

interface GoogleEvent {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email?: string }[];
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

function connectionView(row: GoogleCalendarConnectionRow): GoogleConnection {
  return {
    id: row.id,
    adminId: row.admin_id,
    email: row.google_email,
    connectedAt: row.connected_at,
    active: row.active,
  };
}

export function isGoogleSyncConfigured(): boolean {
  return Boolean(
    config.googleClientId &&
      config.googleClientSecret &&
      config.googleTokenEncryptionKey
  );
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchange the one-time OAuth code. The ID token is used only as a display hint. */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string | null; email: string | null; scopes: string[] }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) return { refreshToken: null, email: null, scopes: [] };
  const json = (await res.json()) as {
    refresh_token?: string;
    id_token?: string;
    scope?: string;
  };
  let email: string | null = null;
  if (json.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(json.id_token.split(".")[1], "base64url").toString("utf8")
      ) as { email?: string };
      email = payload.email || null;
    } catch {
      email = null;
    }
  }
  return {
    refreshToken: json.refresh_token || null,
    email,
    scopes: json.scope?.split(/\s+/).filter(Boolean) || [...GOOGLE_OAUTH_SCOPES],
  };
}

async function accessTokenForCiphertext(ciphertext: string): Promise<string> {
  const refreshToken = decryptCalendarSecret(ciphertext, config.googleTokenEncryptionKey);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${detail.slice(0, 180)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google token refresh returned no access token");
  return json.access_token;
}

async function googleFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
  accepted: number[] = [200]
): Promise<T> {
  const res = await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!accepted.includes(res.status)) {
    const detail = await res.text();
    const error = new Error(
      `Google Calendar API failed (${res.status}): ${detail.slice(0, 240)}`
    ) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function connectionRowByAdmin(
  adminId: string
): Promise<GoogleCalendarConnectionRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .select("*")
    .eq("admin_id", adminId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GoogleCalendarConnectionRow | null) || null;
}

/** Save encrypted credentials and discover the calendars Google exposed. */
export async function saveGoogleConnection(
  adminId: string,
  refreshToken: string,
  email: string | null,
  scopes: string[] = [...GOOGLE_OAUTH_SCOPES]
): Promise<GoogleConnection> {
  if (!isGoogleSyncConfigured()) throw new Error("Google Calendar is not configured");
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .upsert(
      {
        admin_id: adminId,
        google_email: email,
        refresh_token_ciphertext: encryptCalendarSecret(
          refreshToken,
          config.googleTokenEncryptionKey
        ),
        scopes,
        active: true,
        connected_at: now,
        last_error: null,
      },
      { onConflict: "admin_id" }
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save Google connection");
  await discoverGoogleCalendars((data as GoogleCalendarConnectionRow).id);
  return connectionView(data as GoogleCalendarConnectionRow);
}

/**
 * One-time bridge for an existing v1 connection. It removes the plaintext
 * app_settings value only after the encrypted v2 row is safely written.
 */
async function migrateLegacyConnection(adminId: string): Promise<GoogleConnection | null> {
  if (!isGoogleSyncConfigured()) return null;
  const key = `${LEGACY_SETTING_PREFIX}${adminId}`;
  const { data } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const value = data?.value as
    | { refresh_token?: string; email?: string; connected_at?: string }
    | undefined;
  if (!value?.refresh_token) return null;
  const connection = await saveGoogleConnection(
    adminId,
    value.refresh_token,
    value.email || null
  );
  await getSupabaseAdmin().from("app_settings").delete().eq("key", key);
  return connection;
}

export async function getGoogleConnection(adminId: string): Promise<GoogleConnection | null> {
  const row = await connectionRowByAdmin(adminId);
  return row ? connectionView(row) : migrateLegacyConnection(adminId);
}

export async function listGoogleConnections(): Promise<GoogleConnection[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .select("*")
    .eq("active", true);
  if (error) throw new Error(error.message);
  return ((data as GoogleCalendarConnectionRow[]) || []).map(connectionView);
}

export async function deleteGoogleConnection(adminId: string): Promise<void> {
  const row = await connectionRowByAdmin(adminId);
  if (!row) return;
  await stopWatchesForConnection(row.id).catch(() => {});
  const { error } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .delete()
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  await getSupabaseAdmin()
    .from("app_settings")
    .delete()
    .eq("key", `${LEGACY_SETTING_PREFIX}${adminId}`);
}

export async function discoverGoogleCalendars(
  connectionId: string
): Promise<GoogleCalendarSource[]> {
  const { data: connection, error } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  if (error || !connection) throw new Error(error?.message || "Google connection not found");
  const row = connection as GoogleCalendarConnectionRow;
  const token = await accessTokenForCiphertext(row.refresh_token_ciphertext);
  const entries: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ minAccessRole: "writer", showDeleted: "false" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<{
      items?: GoogleCalendarListEntry[];
      nextPageToken?: string;
    }>(token, `/users/me/calendarList?${params}`);
    entries.push(...(page.items || []).filter((item) => !item.deleted));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const db = getSupabaseAdmin();
  const { data: current } = await db
    .from("google_calendar_sources")
    .select("*")
    .eq("connection_id", row.id);
  const currentById = new Map(
    ((current as GoogleCalendarSourceRow[]) || []).map((source) => [
      source.google_calendar_id,
      source,
    ])
  );

  for (const entry of entries) {
    const existing = currentById.get(entry.id);
    const payload = {
      connection_id: row.id,
      google_calendar_id: entry.id,
      summary: entry.summary || entry.id,
      timezone: entry.timeZone || null,
      is_primary: Boolean(entry.primary),
      // Primary is the safe default. Existing choices are never overwritten.
      selected: existing?.selected ?? Boolean(entry.primary),
      detail_visibility: existing?.detail_visibility || "details",
      last_error: null,
    };
    const { error: upsertError } = await db
      .from("google_calendar_sources")
      .upsert(payload, { onConflict: "connection_id,google_calendar_id" });
    if (upsertError) throw new Error(upsertError.message);
  }
  return listGoogleSourcesForConnection(row.id);
}

async function listGoogleSourcesForConnection(
  connectionId: string
): Promise<GoogleCalendarSource[]> {
  const { data: connection } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .select("admin_id, google_email")
    .eq("id", connectionId)
    .single();
  if (!connection) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("google_calendar_sources")
    .select("*")
    .eq("connection_id", connectionId)
    .order("is_primary", { ascending: false })
    .order("summary");
  if (error) throw new Error(error.message);
  return ((data as GoogleCalendarSourceRow[]) || []).map((source) => ({
    ...source,
    adminId: connection.admin_id,
    googleEmail: connection.google_email,
  }));
}

export async function listGoogleSources(adminId: string): Promise<GoogleCalendarSource[]> {
  const connection = await connectionRowByAdmin(adminId);
  return connection ? listGoogleSourcesForConnection(connection.id) : [];
}

export async function listAllGoogleSources(): Promise<GoogleCalendarSource[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .select("id")
    .eq("active", true);
  if (error) throw new Error(error.message);
  const result: GoogleCalendarSource[] = [];
  for (const connection of data || []) {
    result.push(...(await listGoogleSourcesForConnection(connection.id)));
  }
  return result;
}

export async function listSelectedGoogleSources(
  adminId?: string | null
): Promise<GoogleCalendarSource[]> {
  const db = getSupabaseAdmin();
  let request = db
    .from("google_calendar_connections")
    .select("id, admin_id, google_email")
    .eq("active", true);
  if (adminId) request = request.eq("admin_id", adminId);
  const { data: connections, error } = await request;
  if (error) throw new Error(error.message);
  const result: GoogleCalendarSource[] = [];
  for (const connection of connections || []) {
    const sources = await listGoogleSourcesForConnection(connection.id);
    result.push(...sources.filter((source) => source.selected));
  }
  return result;
}

export async function updateGoogleSourceSelection(
  adminId: string,
  selectedSourceIds: string[]
): Promise<void> {
  const connection = await connectionRowByAdmin(adminId);
  if (!connection) throw new Error("Connect Google Calendar first");
  const sources = await listGoogleSourcesForConnection(connection.id);
  const allowed = new Set(sources.map((source) => source.id));
  const selected = new Set(selectedSourceIds.filter((id) => allowed.has(id)));
  if (selected.size === 0) throw new Error("Choose at least one calendar");
  for (const source of sources) {
    const { error } = await getSupabaseAdmin()
      .from("google_calendar_sources")
      .update({ selected: selected.has(source.id), sync_token: null })
      .eq("id", source.id);
    if (error) throw new Error(error.message);
  }
}

async function sourceWithConnection(sourceId: string): Promise<{
  source: GoogleCalendarSourceRow;
  connection: GoogleCalendarConnectionRow;
}> {
  const { data: source, error } = await getSupabaseAdmin()
    .from("google_calendar_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error || !source) throw new Error(error?.message || "Calendar source not found");
  const { data: connection, error: connectionError } = await getSupabaseAdmin()
    .from("google_calendar_connections")
    .select("*")
    .eq("id", source.connection_id)
    .eq("active", true)
    .single();
  if (connectionError || !connection) {
    throw new Error(connectionError?.message || "Calendar connection is inactive");
  }
  return {
    source: source as GoogleCalendarSourceRow,
    connection: connection as GoogleCalendarConnectionRow,
  };
}

async function accessForSource(sourceId: string) {
  const pair = await sourceWithConnection(sourceId);
  return {
    ...pair,
    accessToken: await accessTokenForCiphertext(pair.connection.refresh_token_ciphertext),
  };
}

export async function fetchGoogleBusy(
  timeMin: string,
  timeMax: string,
  hostId?: string | null
): Promise<BusyInterval[]> {
  if (!isGoogleSyncConfigured()) return [];
  const sources = await listSelectedGoogleSources(hostId);
  if (!sources.length) return [];
  const byConnection = new Map<string, GoogleCalendarSource[]>();
  for (const source of sources) {
    const list = byConnection.get(source.connection_id) || [];
    list.push(source);
    byConnection.set(source.connection_id, list);
  }
  const results: BusyInterval[] = [];
  for (const [connectionId, calendars] of byConnection) {
    try {
      const { data: connection } = await getSupabaseAdmin()
        .from("google_calendar_connections")
        .select("*")
        .eq("id", connectionId)
        .single();
      if (!connection) continue;
      const token = await accessTokenForCiphertext(connection.refresh_token_ciphertext);
      const response = await googleFetch<{
        calendars?: Record<string, { busy?: BusyInterval[] }>;
      }>(token, "/freeBusy", {
        method: "POST",
        body: JSON.stringify({
          timeMin,
          timeMax,
          items: calendars.map((source) => ({ id: source.google_calendar_id })),
        }),
      });
      for (const calendar of Object.values(response.calendars || {})) {
        results.push(...(calendar.busy || []));
      }
    } catch {
      // Calendar outages must never break public slot discovery.
    }
  }
  return results;
}

function eventBody(event: GoogleEventInput, entity?: { type: "screening_call" | "event"; id: string }) {
  return {
    summary: event.summary,
    description: event.description || "",
    location: event.location || undefined,
    start: { dateTime: event.startIso, timeZone: event.timezone },
    end: { dateTime: event.endIso, timeZone: event.timezone },
    attendees: event.attendees?.map((email) => ({ email })),
    extendedProperties: entity
      ? {
          private: {
            collectiveEntityType: entity.type,
            collectiveEntityId: entity.id,
          },
        }
      : undefined,
  };
}

/** Push a Collective event to the selected calendar(s) owned by its host. */
export async function pushGoogleEvent(
  event: GoogleEventInput,
  hostId?: string | null,
  entity?: { type: "screening_call" | "event"; id: string }
): Promise<Record<string, string>> {
  if (!isGoogleSyncConfigured()) return {};
  let sources = await listSelectedGoogleSources(hostId);
  if (hostId && !sources.length) sources = await listSelectedGoogleSources();
  // Availability reads every selected calendar, but a Collective booking is
  // written once per connected account (primary if selected, otherwise the
  // first selected calendar) so choosing multiple calendars never duplicates it.
  const writeTargets = new Map<string, GoogleCalendarSource>();
  for (const source of sources) {
    const current = writeTargets.get(source.connection_id);
    if (!current || source.is_primary) writeTargets.set(source.connection_id, source);
  }
  sources = [...writeTargets.values()];
  const ids: Record<string, string> = {};
  for (const source of sources) {
    try {
      const { accessToken } = await accessForSource(source.id);
      const created = await googleFetch<GoogleEvent>(
        accessToken,
        `/calendars/${encodeURIComponent(source.google_calendar_id)}/events`,
        { method: "POST", body: JSON.stringify(eventBody(event, entity)) }
      );
      if (!created.id) continue;
      ids[source.adminId] = created.id;
      if (entity) {
        await getSupabaseAdmin().from("calendar_event_links").upsert(
          {
            source_id: source.id,
            entity_type: entity.type,
            entity_id: entity.id,
            google_event_id: created.id,
            google_etag: created.etag || null,
            last_origin: "collective",
            google_deleted_at: null,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "source_id,entity_type,entity_id" }
        );
      }
    } catch {
      // A Google failure is visible in reconciliation but never blocks booking.
    }
  }
  return ids;
}

/** Remove linked events. Legacy event-id maps remain supported during migration. */
export async function deleteGoogleEvent(
  eventIds: Record<string, string> | null,
  entity?: { type: "screening_call" | "event"; id: string }
): Promise<void> {
  if (!isGoogleSyncConfigured()) return;
  const targets: { sourceId: string; eventId: string }[] = [];
  if (entity) {
    const { data } = await getSupabaseAdmin()
      .from("calendar_event_links")
      .select("source_id, google_event_id")
      .eq("entity_type", entity.type)
      .eq("entity_id", entity.id);
    targets.push(
      ...((data as Pick<CalendarEventLinkRow, "source_id" | "google_event_id">[]) || []).map(
        (row) => ({ sourceId: row.source_id, eventId: row.google_event_id })
      )
    );
  }
  if (!targets.length && eventIds) {
    for (const [adminId, eventId] of Object.entries(eventIds)) {
      const sources = await listGoogleSources(adminId);
      const primary = sources.find((source) => source.is_primary) || sources[0];
      if (primary) targets.push({ sourceId: primary.id, eventId });
    }
  }
  for (const target of targets) {
    try {
      const { source, accessToken } = await accessForSource(target.sourceId);
      await googleFetch<void>(
        accessToken,
        `/calendars/${encodeURIComponent(source.google_calendar_id)}/events/${encodeURIComponent(target.eventId)}`,
        { method: "DELETE" },
        [204, 410]
      );
      await getSupabaseAdmin()
        .from("calendar_event_links")
        .update({
          google_deleted_at: new Date().toISOString(),
          last_origin: "collective",
          last_synced_at: new Date().toISOString(),
        })
        .eq("source_id", target.sourceId)
        .eq("google_event_id", target.eventId);
    } catch {
      // fail-soft, reconciliation will retry/repair
    }
  }
}

function eventTime(value?: { dateTime?: string; date?: string }): string | null {
  return value?.dateTime || (value?.date ? `${value.date}T00:00:00.000Z` : null);
}

function redactAgendaEvent(
  event: GoogleEvent,
  detailLevel: CalendarDetailLevel
): CalendarAgendaEvent | null {
  if (!event.id) return null;
  const base: CalendarAgendaEvent = {
    id: event.id,
    status: event.status || "confirmed",
    start: eventTime(event.start),
    end: eventTime(event.end),
  };
  if (detailLevel === "busy") return base;
  base.summary = event.summary || "(untitled)";
  base.location = event.location;
  base.htmlLink = event.htmlLink;
  if (detailLevel === "private") {
    base.description = event.description;
    base.attendees = event.attendees?.flatMap((attendee) =>
      attendee.email ? [attendee.email] : []
    );
  }
  return base;
}

export async function listCalendarAgenda(
  sourceId: string,
  timeMin: string,
  timeMax: string,
  detailLevel: CalendarDetailLevel = "details"
): Promise<CalendarAgendaEvent[]> {
  const { source, accessToken } = await accessForSource(sourceId);
  const events: CalendarAgendaEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      accessToken,
      `/calendars/${encodeURIComponent(source.google_calendar_id)}/events?${params}`
    );
    events.push(
      ...(page.items || []).flatMap((event) => {
        const redacted = redactAgendaEvent(event, detailLevel);
        return redacted ? [redacted] : [];
      })
    );
    pageToken = page.nextPageToken;
  } while (pageToken);
  return events;
}

export async function createGoogleCalendarEvent(
  sourceId: string,
  input: GoogleEventInput,
  providerEventId?: string
): Promise<CalendarAgendaEvent> {
  const { source, accessToken } = await accessForSource(sourceId);
  let created: GoogleEvent;
  try {
    created = await googleFetch<GoogleEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(source.google_calendar_id)}/events`,
      {
        method: "POST",
        body: JSON.stringify({ ...eventBody(input), id: providerEventId }),
      }
    );
  } catch (error) {
    // A deterministic provider id makes SQS/Lambda retries safe even if Google
    // committed the first insert just before the worker timed out.
    if ((error as Error & { status?: number }).status !== 409 || !providerEventId) throw error;
    created = await googleFetch<GoogleEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(source.google_calendar_id)}/events/${encodeURIComponent(providerEventId)}`
    );
  }
  const result = redactAgendaEvent(created, "private");
  if (!result) throw new Error("Google returned no event id");
  return result;
}

export function googleEventIdForIdempotencyKey(idempotencyKey: string): string {
  return `c${crypto.createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 48)}`;
}

export async function updateGoogleCalendarEvent(
  sourceId: string,
  eventId: string,
  input: Partial<GoogleEventInput>
): Promise<CalendarAgendaEvent> {
  const { source, accessToken } = await accessForSource(sourceId);
  const body: Record<string, unknown> = {};
  if (input.summary !== undefined) body.summary = input.summary;
  if (input.description !== undefined) body.description = input.description;
  if (input.location !== undefined) body.location = input.location;
  if (input.startIso) body.start = { dateTime: input.startIso, timeZone: input.timezone };
  if (input.endIso) body.end = { dateTime: input.endIso, timeZone: input.timezone };
  if (input.attendees) body.attendees = input.attendees.map((email) => ({ email }));
  const updated = await googleFetch<GoogleEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(source.google_calendar_id)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  const result = redactAgendaEvent(updated, "private");
  if (!result) throw new Error("Google returned no event id");
  return result;
}

export async function cancelGoogleCalendarEvent(
  sourceId: string,
  eventId: string
): Promise<void> {
  const { source, accessToken } = await accessForSource(sourceId);
  await googleFetch<void>(
    accessToken,
    `/calendars/${encodeURIComponent(source.google_calendar_id)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
    [204, 410]
  );
}

async function applyGoogleChangeToCollective(
  sourceId: string,
  event: GoogleEvent
): Promise<void> {
  if (!event.id) return;
  const db = getSupabaseAdmin();
  const { data: linked } = await db
    .from("calendar_event_links")
    .select("*")
    .eq("source_id", sourceId)
    .eq("google_event_id", event.id)
    .maybeSingle();
  const privateFields = event.extendedProperties?.private;
  let link = linked as CalendarEventLinkRow | null;
  if (
    !link &&
    (privateFields?.collectiveEntityType === "screening_call" ||
      privateFields?.collectiveEntityType === "event") &&
    privateFields.collectiveEntityId
  ) {
    const { data } = await db
      .from("calendar_event_links")
      .upsert(
        {
          source_id: sourceId,
          entity_type: privateFields.collectiveEntityType,
          entity_id: privateFields.collectiveEntityId,
          google_event_id: event.id,
          google_etag: event.etag || null,
          last_origin: "google",
          google_deleted_at: null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "source_id,entity_type,entity_id" }
      )
      .select("*")
      .single();
    link = data as CalendarEventLinkRow | null;
  }
  if (!link) return; // never import arbitrary personal events into Collective

  const now = new Date().toISOString();
  if (event.status === "cancelled") {
    if (link.entity_type === "screening_call") {
      await db
        .from("screening_calls")
        .update({ status: "cancelled", notes: "Cancelled from Google Calendar" })
        .eq("id", link.entity_id);
    } else {
      await db.from("events").update({ status: "cancelled" }).eq("id", link.entity_id);
    }
    await db
      .from("calendar_event_links")
      .update({
        google_etag: event.etag || null,
        google_deleted_at: now,
        last_origin: "google",
        last_synced_at: now,
      })
      .eq("id", link.id);
    return;
  }

  const start = eventTime(event.start);
  const end = eventTime(event.end);
  if (start && end && link.entity_type === "screening_call") {
    const duration = Math.max(
      1,
      Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000)
    );
    await db
      .from("screening_calls")
      .update({
        scheduled_at: new Date(start).toISOString(),
        duration_minutes: duration,
        timezone: event.start?.timeZone || undefined,
        status: "scheduled",
      })
      .eq("id", link.entity_id);
  } else if (start && link.entity_type === "event") {
    await db
      .from("events")
      .update({
        start_at: new Date(start).toISOString(),
        end_at: end ? new Date(end).toISOString() : null,
      })
      .eq("id", link.entity_id);
  }
  await db
    .from("calendar_event_links")
    .update({
      google_etag: event.etag || null,
      google_deleted_at: null,
      last_origin: "google",
      last_synced_at: now,
    })
    .eq("id", link.id);
}

export async function syncCalendarSource(
  sourceId: string,
  forceFull = false
): Promise<{ changed: number; nextSyncToken: string }> {
  const { source, accessToken } = await accessForSource(sourceId);
  const db = getSupabaseAdmin();
  let syncToken = forceFull ? null : source.sync_token;
  let pageToken: string | undefined;
  let changed = 0;
  let nextSyncToken = "";

  const run = async () => {
    do {
      const params = new URLSearchParams({
        showDeleted: "true",
        singleEvents: "true",
        maxResults: "250",
      });
      if (syncToken) params.set("syncToken", syncToken);
      else params.set("timeMin", new Date(Date.now() - 90 * 86400_000).toISOString());
      if (pageToken) params.set("pageToken", pageToken);
      const page = await googleFetch<{
        items?: GoogleEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
      }>(
        accessToken,
        `/calendars/${encodeURIComponent(source.google_calendar_id)}/events?${params}`
      );
      for (const event of page.items || []) {
        await applyGoogleChangeToCollective(sourceId, event);
        changed += 1;
      }
      pageToken = page.nextPageToken;
      if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
    } while (pageToken);
  };

  try {
    await run();
  } catch (error) {
    if ((error as Error & { status?: number }).status === 410 && syncToken) {
      syncToken = null;
      pageToken = undefined;
      changed = 0;
      await run();
    } else {
      const message = error instanceof Error ? error.message : "Calendar sync failed";
      await db
        .from("google_calendar_sources")
        .update({ last_error: message.slice(0, 500) })
        .eq("id", sourceId);
      throw error;
    }
  }
  if (!nextSyncToken) throw new Error("Google did not return a sync token");
  const now = new Date().toISOString();
  await db
    .from("google_calendar_sources")
    .update({ sync_token: nextSyncToken, last_synced_at: now, last_error: null })
    .eq("id", sourceId);
  await db
    .from("google_calendar_connections")
    .update({ last_synced_at: now, last_error: null })
    .eq("id", source.connection_id);
  return { changed, nextSyncToken };
}

export async function watchCalendarSource(sourceId: string): Promise<void> {
  if (!config.googleCalendarWebhookUrl) {
    throw new Error("GOOGLE_CALENDAR_WEBHOOK_URL is not configured");
  }
  const { source, accessToken } = await accessForSource(sourceId);
  if (source.watch_channel_id && source.watch_resource_id) {
    await googleFetch<void>(
      accessToken,
      "/channels/stop",
      {
        method: "POST",
        body: JSON.stringify({
          id: source.watch_channel_id,
          resourceId: source.watch_resource_id,
        }),
      },
      [204, 404]
    ).catch(() => {});
  }
  const channelId = crypto.randomUUID();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const response = await googleFetch<{
    id: string;
    resourceId: string;
    expiration?: string;
  }>(
    accessToken,
    `/calendars/${encodeURIComponent(source.google_calendar_id)}/events/watch`,
    {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: config.googleCalendarWebhookUrl,
        token: rawToken,
        params: { ttl: String(WATCH_TTL_SECONDS) },
      }),
    }
  );
  await getSupabaseAdmin()
    .from("google_calendar_sources")
    .update({
      watch_channel_id: response.id,
      watch_resource_id: response.resourceId,
      watch_token_hash: hashCalendarToken(rawToken),
      watch_expires_at: response.expiration
        ? new Date(Number(response.expiration)).toISOString()
        : new Date(Date.now() + WATCH_TTL_SECONDS * 1000).toISOString(),
      last_error: null,
    })
    .eq("id", sourceId);
}

async function stopWatchesForConnection(connectionId: string): Promise<void> {
  const sources = await listGoogleSourcesForConnection(connectionId);
  for (const source of sources) {
    if (!source.watch_channel_id || !source.watch_resource_id) continue;
    try {
      const { accessToken } = await accessForSource(source.id);
      await googleFetch<void>(
        accessToken,
        "/channels/stop",
        {
          method: "POST",
          body: JSON.stringify({
            id: source.watch_channel_id,
            resourceId: source.watch_resource_id,
          }),
        },
        [204, 404]
      );
    } catch {
      // Connection deletion remains possible even if Google is unavailable.
    }
  }
}

export async function resolveWebhookSource(headers: Headers): Promise<string | null> {
  const channelId = headers.get("x-goog-channel-id");
  const resourceId = headers.get("x-goog-resource-id");
  const token = headers.get("x-goog-channel-token");
  if (!channelId || !resourceId || !token) return null;
  const { data } = await getSupabaseAdmin()
    .from("google_calendar_sources")
    .select("id, watch_token_hash")
    .eq("watch_channel_id", channelId)
    .eq("watch_resource_id", resourceId)
    .maybeSingle();
  if (!data?.watch_token_hash) return null;
  const expected = Buffer.from(data.watch_token_hash, "hex");
  const actual = Buffer.from(hashCalendarToken(token), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
    ? data.id
    : null;
}

/** Daily reconciliation: renew expiring watches and always pull incrementally. */
export async function reconcileGoogleCalendars(): Promise<{
  synced: number;
  renewed: number;
  failed: number;
}> {
  const sources = await listSelectedGoogleSources();
  let synced = 0;
  let renewed = 0;
  let failed = 0;
  for (const source of sources) {
    try {
      await syncCalendarSource(source.id);
      synced += 1;
      const expires = source.watch_expires_at
        ? new Date(source.watch_expires_at).getTime()
        : 0;
      if (!expires || expires < Date.now() + 36 * 60 * 60_000) {
        await watchCalendarSource(source.id);
        renewed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { synced, renewed, failed };
}
