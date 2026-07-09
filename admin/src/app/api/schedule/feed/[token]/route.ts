import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import type { ScreeningCallRow } from "@core/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google Calendar connector: a token-protected ICS feed of screening calls
 * and interviews. Admins subscribe once (Google Calendar → Other calendars →
 * From URL) and bookings appear in their calendar — no OAuth, read-only.
 * Tokens live in app_settings (calendar_feed:<adminId>) and can be rotated
 * from the Schedule page. Google refreshes subscribed feeds every ~8–24h.
 */

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const icsDate = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Token → owning admin (one setting row per admin).
  const supabase = getSupabaseAdmin();
  const { data: settingRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .like("key", "calendar_feed:%");
  const match = (settingRows || []).find((row) => row.value === token);
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: callsRaw } = await supabase
    .from("screening_calls")
    .select("*")
    .gte("scheduled_at", since)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true })
    .limit(200);
  const calls = (callsRaw as ScreeningCallRow[]) || [];

  const events = calls
    .map((call) => {
      const start = icsDate(call.scheduled_at);
      const end = icsDate(
        new Date(new Date(call.scheduled_at).getTime() + (call.duration_minutes || 15) * 60_000).toISOString()
      );
      const kind = call.kind === "vendor" ? "Interview" : "Screening call";
      return [
        "BEGIN:VEVENT",
        `UID:collective-${call.id}@opencollective.app`,
        `DTSTAMP:${icsDate(call.created_at)}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${esc(`${kind} — ${call.prospect_name}`)}`,
        `DESCRIPTION:${esc(`${call.prospect_email}${call.notes ? `\n${call.notes}` : ""}\nStatus: ${call.status}`)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Collective//Operator OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Collective — Screenings",
    "X-WR-TIMEZONE:Europe/Madrid",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="collective-screenings.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
