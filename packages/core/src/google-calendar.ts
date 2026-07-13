import { config } from "./config";
import { getSupabaseAdmin } from "./supabase";

/**
 * Google Calendar two-way sync (per-admin, OAuth refresh tokens).
 *
 * Direction 1 — push: screening calls/interviews are inserted into every
 * connected admin's primary calendar the moment a prospect books, and removed
 * again on cancel/reschedule. Event ids live on screening_calls.google_event_ids
 * as {"<adminId>": "<googleEventId>"}.
 *
 * Direction 2 — pull: each connected admin's busy periods (any event in their
 * Google calendar) are subtracted from the public slot picker via freeBusy, so
 * prospects can never book over a host's private appointment.
 *
 * Connections are stored in app_settings under gcal_oauth:<adminId> as
 * {"refresh_token": "...", "email": "...", "connected_at": iso}. The feature is
 * inert until GOOGLE_OAUTH_CLIENT_ID/SECRET are set — every entry point checks
 * isGoogleSyncConfigured() and fails soft, and the read-only ICS feed keeps
 * working either way.
 */

const SETTING_PREFIX = "gcal_oauth:";
export const GOOGLE_OAUTH_SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";

export interface GoogleConnection {
  adminId: string;
  refreshToken: string;
  email: string | null;
  connectedAt: string | null;
}

export interface BusyInterval {
  start: string; // ISO
  end: string; // ISO
}

export function isGoogleSyncConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent", // always mint a refresh token, even on re-connect
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchange the OAuth authorization code for tokens. */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string | null; email: string | null }> {
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
  if (!res.ok) return { refreshToken: null, email: null };
  const json = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    id_token?: string;
  };
  // The id_token payload carries the account email — decode without verifying
  // (we just received it over TLS from Google's token endpoint).
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
  return { refreshToken: json.refresh_token || null, email };
}

export async function saveGoogleConnection(
  adminId: string,
  refreshToken: string,
  email: string | null
): Promise<void> {
  await getSupabaseAdmin()
    .from("app_settings")
    .upsert(
      {
        key: `${SETTING_PREFIX}${adminId}`,
        value: { refresh_token: refreshToken, email, connected_at: new Date().toISOString() },
      },
      { onConflict: "key" }
    );
}

export async function deleteGoogleConnection(adminId: string): Promise<void> {
  await getSupabaseAdmin().from("app_settings").delete().eq("key", `${SETTING_PREFIX}${adminId}`);
}

export async function getGoogleConnection(adminId: string): Promise<GoogleConnection | null> {
  const { data } = await getSupabaseAdmin()
    .from("app_settings")
    .select("key, value")
    .eq("key", `${SETTING_PREFIX}${adminId}`)
    .maybeSingle();
  return data ? rowToConnection(data as { key: string; value: unknown }) : null;
}

export async function listGoogleConnections(): Promise<GoogleConnection[]> {
  const { data } = await getSupabaseAdmin()
    .from("app_settings")
    .select("key, value")
    .like("key", `${SETTING_PREFIX}%`);
  return ((data as { key: string; value: unknown }[]) || [])
    .map(rowToConnection)
    .filter((c): c is GoogleConnection => c !== null);
}

function rowToConnection(row: { key: string; value: unknown }): GoogleConnection | null {
  const value = row.value as { refresh_token?: string; email?: string; connected_at?: string } | null;
  if (!value?.refresh_token) return null;
  return {
    adminId: row.key.slice(SETTING_PREFIX.length),
    refreshToken: value.refresh_token,
    email: value.email || null,
    connectedAt: value.connected_at || null,
  };
}

async function accessTokenFor(refreshToken: string): Promise<string | null> {
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
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token || null;
}

/**
 * Busy periods from connected admins' primary calendars. Pass `hostId` to
 * scope to one host's calendar (per-host screening); omit for all admins.
 * Fail-soft: a dead connection or Google hiccup returns [] for that admin
 * rather than blocking the slot picker.
 */
export async function fetchGoogleBusy(
  timeMin: string,
  timeMax: string,
  hostId?: string | null
): Promise<BusyInterval[]> {
  if (!isGoogleSyncConfigured()) return [];
  let connections = await listGoogleConnections();
  if (hostId) connections = connections.filter((c) => c.adminId === hostId);
  if (!connections.length) return [];

  const results = await Promise.all(
    connections.map(async (conn) => {
      try {
        const token = await accessTokenFor(conn.refreshToken);
        if (!token) return [];
        const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as {
          calendars?: { primary?: { busy?: { start: string; end: string }[] } };
        };
        return json.calendars?.primary?.busy || [];
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

/**
 * Insert an event into connected admins' calendars. With `hostId`, only the
 * assigned host's calendar gets the event — unless that host has no connection
 * yet, in which case every connected admin receives it so nothing is missed.
 * Returns the adminId → eventId map to store on the call row (empty when dark).
 */
export async function pushGoogleEvent(
  event: {
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
  },
  hostId?: string | null
): Promise<Record<string, string>> {
  if (!isGoogleSyncConfigured()) return {};
  let connections = await listGoogleConnections();
  if (hostId) {
    const hostConnections = connections.filter((c) => c.adminId === hostId);
    if (hostConnections.length) connections = hostConnections;
  }
  const ids: Record<string, string> = {};

  await Promise.all(
    connections.map(async (conn) => {
      try {
        const token = await accessTokenFor(conn.refreshToken);
        if (!token) return;
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              summary: event.summary,
              description: event.description || "",
              start: { dateTime: event.startIso },
              end: { dateTime: event.endIso },
            }),
          }
        );
        if (!res.ok) return;
        const json = (await res.json()) as { id?: string };
        if (json.id) ids[conn.adminId] = json.id;
      } catch {
        // fail-soft per admin
      }
    })
  );
  return ids;
}

/** Remove a previously pushed event from each admin's calendar. */
export async function deleteGoogleEvent(eventIds: Record<string, string> | null): Promise<void> {
  if (!isGoogleSyncConfigured() || !eventIds || !Object.keys(eventIds).length) return;
  const connections = await listGoogleConnections();

  await Promise.all(
    Object.entries(eventIds).map(async ([adminId, eventId]) => {
      const conn = connections.find((c) => c.adminId === adminId);
      if (!conn) return;
      try {
        const token = await accessTokenFor(conn.refreshToken);
        if (!token) return;
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        // fail-soft
      }
    })
  );
}
