import type { BookingRow, AvailabilityBlockRow, RoomRow, BookingStatus } from "./database.types";
import type { Db } from "./supabase";

/**
 * Availability rules (single source of truth for member request flow,
 * admin approval, and calendar rendering):
 * - A booking blocks its room for [check_in, check_out) once an operator has
 *   accepted it (approved and beyond). Pending "requested" holds do NOT block —
 *   operators arbitrate overlaps at approval time.
 * - availability_blocks rows with status !== 'available' block their date.
 * - closure_periods close a whole villa (room_id NULL) or one room for
 *   [starts_on .. ends_on] inclusive; ends_on NULL = closed indefinitely.
 */

export interface ClosureLike {
  room_id: string | null;
  starts_on: string;
  ends_on: string | null;
}

/** Does any closure cover a night of [checkIn, checkOut) for this room? */
export function isClosedFor(
  roomId: string,
  checkIn: string,
  checkOut: string,
  closures: ClosureLike[]
): boolean {
  return closures.some(
    (c) =>
      (c.room_id === null || c.room_id === roomId) &&
      c.starts_on < checkOut &&
      (c.ends_on === null || c.ends_on >= checkIn)
  );
}

/**
 * Closures relevant to a villa within [from, to). Pass to=null for
 * "everything from `from` onward" (calendar horizons, admin views).
 * Room-level closures carry villa_id too (the admin action sets both),
 * so one villa-scoped query covers everything.
 */
export async function fetchVillaClosures(
  db: Db,
  villaId: string,
  from: string,
  to: string | null
): Promise<ClosureLike[]> {
  let query = db
    .from("closure_periods")
    .select("room_id, starts_on, ends_on")
    .eq("villa_id", villaId)
    .or(`ends_on.is.null,ends_on.gte.${from}`);
  if (to) query = query.lt("starts_on", to);
  const { data } = await query;
  return (data as ClosureLike[]) || [];
}
export const BLOCKING_STATUSES: BookingStatus[] = [
  "approved",
  "deposit_paid",
  "paid",
  "confirmed",
];

/** [aStart, aEnd) overlaps [bStart, bEnd) — dates as YYYY-MM-DD strings. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function isRoomAvailable(
  roomId: string,
  checkIn: string,
  checkOut: string,
  bookings: Pick<BookingRow, "room_id" | "check_in" | "check_out" | "status">[],
  blocks: Pick<AvailabilityBlockRow, "room_id" | "date" | "status">[],
  closures: ClosureLike[] = []
): boolean {
  if (isClosedFor(roomId, checkIn, checkOut, closures)) return false;

  const bookingConflict = bookings.some(
    (b) =>
      b.room_id === roomId &&
      BLOCKING_STATUSES.includes(b.status) &&
      rangesOverlap(checkIn, checkOut, b.check_in, b.check_out)
  );
  if (bookingConflict) return false;

  return !blocks.some(
    (bl) =>
      bl.room_id === roomId &&
      bl.status !== "available" &&
      bl.date >= checkIn &&
      bl.date < checkOut
  );
}

export function filterAvailableRooms(
  rooms: RoomRow[],
  checkIn: string,
  checkOut: string,
  bookings: Pick<BookingRow, "room_id" | "check_in" | "check_out" | "status">[],
  blocks: Pick<AvailabilityBlockRow, "room_id" | "date" | "status">[],
  closures: ClosureLike[] = []
): RoomRow[] {
  return rooms.filter((r) => isRoomAvailable(r.id, checkIn, checkOut, bookings, blocks, closures));
}

/**
 * Per-date free-room count for a gate (calendar birds-eye view).
 * Returns a map of YYYY-MM-DD -> number of rooms with no blocking booking/block.
 */
export function buildDailyAvailability(
  rooms: Pick<RoomRow, "id">[],
  from: string,
  to: string,
  bookings: Pick<BookingRow, "room_id" | "check_in" | "check_out" | "status">[],
  blocks: Pick<AvailabilityBlockRow, "room_id" | "date" | "status">[],
  closures: ClosureLike[] = []
): Record<string, number> {
  const days = eachDate(from, to);
  const out: Record<string, number> = {};
  for (const day of days) {
    const nextDay = new Date(`${day}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const dayEnd = nextDay.toISOString().slice(0, 10);
    out[day] = rooms.filter((r) =>
      isRoomAvailable(r.id, day, dayEnd, bookings, blocks, closures)
    ).length;
  }
  return out;
}
