/**
 * Time display rules — MOBILE_UI_SPEC.md §5.
 *
 * The timeline sorts on `sortAt` but shows a clock only when punctuality is
 * operationally meaningful. Applications, approvals, general upkeep, supplies,
 * notes, dues and unscheduled follow-ups must never show an invented time.
 */

import type { DisplayPrecision } from "@/data/contracts";

/** The Collective operates on one timezone; fixed so renders are stable. */
export const OPERATING_TIME_ZONE = "Europe/Madrid";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: OPERATING_TIME_ZONE,
});

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: OPERATING_TIME_ZONE,
});

const shortDayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: OPERATING_TIME_ZONE,
});

const isoDayFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: OPERATING_TIME_ZONE,
});

/**
 * The only place a row decides whether to print a clock.
 * Returns null when time must be omitted.
 */
export function displayTime(iso: string, precision: DisplayPrecision): string | null {
  if (precision !== "minute") return null;
  return timeFmt.format(new Date(iso));
}

/** "Sunday, 26 July" */
export function formatDayLong(iso: string): string {
  const parts = dayFmt.formatToParts(new Date(iso));
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${weekday}, ${day} ${month}`;
}

/** "26 Jul" */
export function formatDayShort(iso: string): string {
  return shortDayFmt.format(new Date(iso));
}

/** Calendar day key in the operating timezone, e.g. "2026-07-26". */
export function isoDay(iso: string): string {
  return isoDayFmt.format(new Date(iso));
}

/** Relative day label used by day dividers. */
export function dayLabel(iso: string, nowIso: string): string {
  const day = isoDay(iso);
  const today = isoDay(nowIso);
  if (day === today) return "Today";

  const oneDay = 86_400_000;
  const diff = Math.round(
    (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / oneDay,
  );
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDayLong(iso);
}

/** Accessible sentence for a row: never time-only, never colour-only. */
export function rowTimeLabel(iso: string, precision: DisplayPrecision): string {
  const t = displayTime(iso, precision);
  if (t) return `at ${t}`;
  if (precision === "day") return `on ${formatDayShort(iso)}`;
  return "no scheduled time";
}
