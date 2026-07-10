import { getSupabaseAdmin } from "./supabase";
import { fetchGoogleBusy } from "./google-calendar";
import type { ScreeningCallRow, ScreeningWindowRow } from "./database.types";

/**
 * Screening-call slot engine. Windows are wall-clock ranges in the villa's
 * timezone (Don's daily blocks); slots are fixed-length steps inside them.
 * Everything is computed server-side against the window's own timezone so DST
 * shifts in Europe/Madrid never skew a booking.
 */

export const DEFAULT_TIMEZONE = "Europe/Madrid";

/** Offset (ms) between a timezone's wall clock and UTC at a given instant. */
function tzOffsetMs(timeZone: string, utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  const hour = get("hour") % 24; // Intl emits "24" for midnight in some locales
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asUtc - utc.getTime();
}

/** UTC instant for a wall-clock (calendar date + minute-of-day) in a timezone. */
export function zonedToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  minuteOfDay: number,
  timeZone: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, minuteOfDay));
  const first = new Date(guess.getTime() - tzOffsetMs(timeZone, guess));
  const second = new Date(guess.getTime() - tzOffsetMs(timeZone, first));
  return second;
}

/** Calendar date (y/m/d) of an instant as seen in a timezone. */
export function dateInZone(utc: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export interface OpenSlot {
  /** UTC instant, ISO string — what gets stored on the call row. */
  startsAt: string;
  /** Villa-local calendar date, e.g. 2026-07-10. */
  dateKey: string;
  /** Villa-local minute of day, e.g. 570 = 09:30. */
  minute: number;
  durationMinutes: number;
  timezone: string;
}

export interface SlotQuery {
  kind: "member" | "vendor";
  windows: ScreeningWindowRow[];
  /** Existing calls that block time (status=scheduled). All kinds block — one host. */
  calls: Pick<ScreeningCallRow, "scheduled_at" | "duration_minutes" | "status">[];
  /** Horizon in days (default 21). */
  days?: number;
  /** Minimum notice in minutes (default 120). */
  leadMinutes?: number;
  now?: Date;
}

/** Enumerate open slots inside the active windows over the horizon. */
export function computeOpenSlots(query: SlotQuery): OpenSlot[] {
  const now = query.now || new Date();
  const days = query.days ?? 21;
  const minStart = now.getTime() + (query.leadMinutes ?? 120) * 60_000;

  const windows = query.windows.filter(
    (w) => w.active && (w.kind === "both" || w.kind === query.kind)
  );
  if (!windows.length) return [];

  const busy = query.calls
    .filter((c) => c.status === "scheduled")
    .map((c) => {
      const start = new Date(c.scheduled_at).getTime();
      return { start, end: start + (c.duration_minutes || 15) * 60_000 };
    });

  const slots: OpenSlot[] = [];
  for (const window of windows) {
    const tz = window.timezone || DEFAULT_TIMEZONE;
    const today = dateInZone(now, tz);
    for (let offset = 0; offset <= days; offset++) {
      // Pure calendar arithmetic — Date.UTC normalises day overflow.
      const local = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
      const [y, m, d] = [local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()];
      const dateKey = iso(y, m, d);
      const matches =
        window.date != null ? window.date === dateKey : window.weekday === local.getUTCDay();
      if (!matches) continue;

      const step = window.slot_minutes || 15;
      for (let minute = window.start_minute; minute + step <= window.end_minute; minute += step) {
        const start = zonedToUtc(y, m, d, minute, tz);
        const startMs = start.getTime();
        const endMs = startMs + step * 60_000;
        if (startMs < minStart) continue;
        if (busy.some((b) => b.start < endMs && b.end > startMs)) continue;
        if (slots.some((s) => s.startsAt === start.toISOString())) continue;
        slots.push({
          startsAt: start.toISOString(),
          dateKey,
          minute,
          durationMinutes: step,
          timezone: tz,
        });
      }
    }
  }
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Re-validate a chosen slot against current windows + calls (forgery/races). */
export function isSlotOpen(query: SlotQuery, startsAtIso: string): OpenSlot | null {
  return computeOpenSlots(query).find((s) => s.startsAt === startsAtIso) || null;
}

/**
 * Windows + blocking calls straight from the database, plus each connected
 * admin's Google Calendar busy periods (two-way sync, pull direction) folded
 * in as synthetic blocking calls so private appointments block the picker.
 */
export async function loadSlotInputs(kind: "member" | "vendor") {
  const supabase = getSupabaseAdmin();
  const horizonStart = new Date(Date.now() - 60 * 60_000).toISOString();
  const horizonEnd = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
  const [{ data: windows }, { data: calls }, googleBusy] = await Promise.all([
    supabase.from("screening_windows").select("*").eq("active", true),
    supabase
      .from("screening_calls")
      .select("scheduled_at, duration_minutes, status")
      .eq("status", "scheduled")
      .gte("scheduled_at", horizonStart)
      .lte("scheduled_at", horizonEnd),
    fetchGoogleBusy(horizonStart, horizonEnd),
  ]);
  const busyAsCalls = googleBusy.map((b) => ({
    scheduled_at: b.start,
    duration_minutes: Math.max(1, Math.ceil((Date.parse(b.end) - Date.parse(b.start)) / 60_000)),
    status: "scheduled" as const,
  }));
  return {
    kind,
    windows: (windows as ScreeningWindowRow[]) || [],
    calls: [
      ...((calls as Pick<ScreeningCallRow, "scheduled_at" | "duration_minutes" | "status">[]) || []),
      ...busyAsCalls,
    ],
  };
}

export function fmtMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
