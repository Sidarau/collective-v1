/**
 * Timeline assembly — MOBILE_UI_SPEC.md §5 "Ordering".
 *
 * Shared by the fixture provider and the live Supabase provider. Unit-tested;
 * reimplement nothing.
 */

import type { OperationEvent } from "./contracts";

const rank = (e: OperationEvent) =>
  e.priority === "critical" ? 0 : e.priority === "attention" ? 1 : 2;

/**
 * Orders a page of events. Completed work sits above the present in reverse
 * chronology; overdue incomplete work is lifted to just above the present so
 * it never disappears into history.
 */
export function orderTimeline(events: OperationEvent[], nowIso: string): OperationEvent[] {
  const now = Date.parse(nowIso);

  const isCarried = (e: OperationEvent) =>
    Boolean(e.carriedFrom) && e.status !== "complete";

  const history = events
    .filter((e) => !isCarried(e) && Date.parse(e.sortAt) < now)
    .sort((a, b) => Date.parse(a.sortAt) - Date.parse(b.sortAt));

  const carried = events
    .filter(isCarried)
    .sort((a, b) => rank(a) - rank(b) || Date.parse(a.sortAt) - Date.parse(b.sortAt));

  // `sortAt` controls placement (MOBILE_UI_SPEC.md §5), so the day reads as
  // one chronology. The spec's timed-then-untimed and priority rules break
  // ties between items that share an instant.
  const upcoming = events
    .filter((e) => !isCarried(e) && Date.parse(e.sortAt) >= now)
    .sort((a, b) => {
      const delta = Date.parse(a.sortAt) - Date.parse(b.sortAt);
      if (delta !== 0) return delta;
      const aTimed = a.displayPrecision === "minute";
      const bTimed = b.displayPrecision === "minute";
      if (aTimed !== bTimed) return aTimed ? -1 : 1;
      return rank(a) - rank(b);
    });

  return [...history, ...carried, ...upcoming];
}

/** Index of the first item at or after the present — where the view lands. */
export function presentIndex(ordered: OperationEvent[], nowIso: string): number {
  const now = Date.parse(nowIso);
  const idx = ordered.findIndex(
    (e) => !e.carriedFrom && Date.parse(e.sortAt) >= now,
  );
  return idx === -1 ? ordered.length : idx;
}

/* ------------------------------------------------------------------ *
 * Keyset cursors — Phase 2 pagination on (sortAt, id)
 * ------------------------------------------------------------------ */

/**
 * Opaque but stable: the cursor encodes the anchor row's (sortAt, id) pair.
 * Comparison is lexicographic on sortAt then id, which matches the SQL
 * `(sort_at, id)` tuple ordering the live provider uses.
 */
export function encodeCursor(sortAt: string, id: string): string {
  return Buffer.from(JSON.stringify([sortAt, id]), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): { sortAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && typeof parsed[0] === "string" && typeof parsed[1] === "string") {
      return { sortAt: parsed[0], id: parsed[1] };
    }
    return null;
  } catch {
    return null;
  }
}

/** Tuple comparison on (sortAt, id) — the keyset ordering. */
export function compareKey(a: { sortAt: string; id: string }, b: { sortAt: string; id: string }): number {
  if (a.sortAt !== b.sortAt) return a.sortAt < b.sortAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}
