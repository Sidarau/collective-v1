import { describe, expect, it } from "vitest";

/**
 * Session re-validation, extracted from the jwt callback in
 * `@core/auth-options`. The callback itself needs a live Supabase admin
 * client, so the decision it makes is modelled here instead — this is the
 * rule that locked an operator out of production.
 *
 * The bug: `authorize()` returned no `tokenVersion`, so every freshly minted
 * token claimed version 1. A row bumped past 1 by a confirmed email change
 * (migration 011) therefore disagreed with its own new token, the callback
 * emptied it, and the middleware bounced the operator straight back to
 * /login — on a sign-in that had just succeeded. Signing in again re-minted
 * version 1 and failed identically, so the lockout was permanent.
 */

type Lookup =
  | { ok: true; liveVersion: number }
  | { ok: true; missing: true }
  | { ok: false };

/** True when the session must be destroyed. */
function revokes(tokenVersion: number, lookup: Lookup): boolean {
  if (!lookup.ok) return false;
  if ("missing" in lookup) return false;
  return lookup.liveVersion !== tokenVersion;
}

/** What `authorize()` puts on the token for a given row. */
const mintedFor = (row: { token_version?: number }) => row.token_version ?? 1;

describe("session re-validation", () => {
  it("keeps a session whose version matches the row", () => {
    expect(revokes(3, { ok: true, liveVersion: 3 })).toBe(false);
  });

  it("revokes a session the row has moved past", () => {
    // The email-change flow bumping 2 -> 3 must kill tokens still on 2.
    expect(revokes(2, { ok: true, liveVersion: 3 })).toBe(true);
  });

  it("mints a token that agrees with a bumped row", () => {
    // The regression: this returned 1 for a row at version 3, and the token
    // was destroyed by the very next check.
    const row = { token_version: 3 };
    expect(mintedFor(row)).toBe(3);
    expect(revokes(mintedFor(row), { ok: true, liveVersion: 3 })).toBe(false);
  });

  it("still mints 1 for a row that predates the column", () => {
    expect(mintedFor({})).toBe(1);
    expect(revokes(mintedFor({}), { ok: true, liveVersion: 1 })).toBe(false);
  });

  it("does not treat a failed lookup as a revocation", () => {
    // A DB hiccup previously read as "version 1" and signed out everyone
    // above 1 — who then could not sign back in, because the replacement
    // token hit the same failing read.
    expect(revokes(3, { ok: false })).toBe(false);
    expect(revokes(1, { ok: false })).toBe(false);
  });

  it("does not revoke when the row is simply absent", () => {
    expect(revokes(3, { ok: true, missing: true })).toBe(false);
  });
});
