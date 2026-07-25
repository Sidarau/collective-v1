/** Public booking policy shared by the slot picker and write-time validation. */
export const DEFAULT_BOOKING_NOTICE_MINUTES = 24 * 60;

export function minimumBookableStartMs(
  now: Date,
  leadMinutes = DEFAULT_BOOKING_NOTICE_MINUTES
): number {
  return now.getTime() + leadMinutes * 60_000;
}
