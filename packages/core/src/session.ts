import { encode } from "next-auth/jwt";
import { config } from "./config";
import { buildSessionTokenClaims } from "./auth-options";
import { sessionCookieName, sessionCookieOptions, SESSION_MAX_AGE } from "./auth-cookies";
import type { UserRole, UserRow } from "./database.types";

export interface MintedSession {
  sessionJwt: string;
  cookie: {
    name: string;
    options: typeof sessionCookieOptions & { maxAge: number };
  };
}

/**
 * Mint the exact NextAuth session cookie for a user we authenticated by
 * other proof (magic link, verified phone OTP, redeemed invite). Callers set
 * it on a top-level 302 response — the ZEUG-414 Safari/iOS-safe pattern.
 */
export async function mintSession(user: Pick<UserRow, "id" | "email" | "role" | "lead_id">): Promise<MintedSession> {
  const claims = buildSessionTokenClaims({
    id: user.id,
    email: user.email,
    name: user.email.split("@")[0],
    role: user.role as UserRole,
    leadId: user.lead_id,
  });
  const sessionJwt = await encode({
    token: claims,
    secret: config.nextAuthSecret,
    maxAge: SESSION_MAX_AGE,
  });
  return {
    sessionJwt,
    cookie: {
      name: sessionCookieName,
      options: { ...sessionCookieOptions, maxAge: SESSION_MAX_AGE },
    },
  };
}
