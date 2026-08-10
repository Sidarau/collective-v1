/**
 * Best-effort fixed-window rate limiter for the public funnel endpoints.
 *
 * In-memory, so on serverless it bounds abuse per warm instance rather than
 * globally — deliberate trade-off: the referral POST is also gated by the
 * honeypot, one-live-application-per-email dedupe, and per-link max_uses, so
 * a precise distributed counter is not worth a new table. Documented at
 * src/app/api/referral/[code]/route.ts.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/** true = allowed, false = over the limit for this window. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) buckets.clear();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
