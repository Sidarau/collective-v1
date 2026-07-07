import { encode } from "next-auth/jwt";
import { config } from "./config";
import { getSupabaseAdmin } from "./supabase";
import { buildSessionTokenClaims } from "./auth-options";
import { sessionCookieName, sessionCookieOptions, SESSION_MAX_AGE } from "./auth-cookies";
import type { UserRow, MagicTokenRow, UserRole } from "./database.types";

export interface MagicConsumeSuccess {
  ok: true;
  sessionJwt: string;
  cookie: {
    name: string;
    options: typeof sessionCookieOptions & { maxAge: number };
  };
  user: UserRow;
}

export interface MagicConsumeFailure {
  ok: false;
  reason: "missing_params" | "link_invalid" | "server_error";
}

/**
 * Server-side magic-link consumption shared by both apps (ZEUG-414 pattern):
 * validate token -> mark used -> mint the same JWT NextAuth would -> caller
 * sets the cookie on a top-level 302 so Safari/iOS WebViews keep it.
 */
export async function consumeMagicToken(
  rawEmail: string | null,
  rawToken: string | null | undefined
): Promise<MagicConsumeSuccess | MagicConsumeFailure> {
  const token = rawToken?.trim();
  if (!rawEmail || !token) return { ok: false, reason: "missing_params" };
  const email = rawEmail.toLowerCase().trim();

  try {
    const supabase = getSupabaseAdmin();
    const { data: magicToken, error } = await supabase
      .from("magic_tokens")
      .select<string, MagicTokenRow & { users: UserRow }>("*, users(*)")
      .eq("token", token)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (error || !magicToken) return { ok: false, reason: "link_invalid" };
    const user = magicToken.users;
    if (!user || user.email !== email) return { ok: false, reason: "link_invalid" };

    await supabase.from("magic_tokens").update({ used: true }).eq("id", magicToken.id);

    const claims = buildSessionTokenClaims({
      id: user.id,
      email: user.email,
      name: email.split("@")[0],
      role: user.role as UserRole,
      leadId: user.lead_id,
    });

    const sessionJwt = await encode({
      token: claims,
      secret: config.nextAuthSecret,
      maxAge: SESSION_MAX_AGE,
    });

    return {
      ok: true,
      sessionJwt,
      cookie: {
        name: sessionCookieName,
        options: { ...sessionCookieOptions, maxAge: SESSION_MAX_AGE },
      },
      user,
    };
  } catch (err) {
    console.error("[magic-consume] error:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "server_error" };
  }
}
