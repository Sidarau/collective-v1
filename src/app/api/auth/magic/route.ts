import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { config } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildSessionTokenClaims } from "@/app/api/auth/[...nextauth]/route";
import {
  sessionCookieName,
  sessionCookieOptions,
  SESSION_MAX_AGE,
} from "@/lib/auth-cookies";
import type { UserRole } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

// next-auth/jwt (jose) + supabase-js need Node, and the response must never be
// cached because it sets a per-user session cookie.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type DbMagicToken = Database["public"]["Tables"]["magic_tokens"]["Row"];

/**
 * Server-side magic-link consumption.
 *
 * The magic link in the email points here. Because this is a top-level GET
 * navigation, the browser honors the `Set-Cookie` on the 302 response — unlike
 * the previous flow, which set the session cookie on a `fetch()` (XHR) response
 * that Safari ITP and the iOS Gmail in-app WebView silently dropped.
 *
 * Flow: validate token -> mark used -> mint the same JWT NextAuth would ->
 * set the session cookie -> redirect to the portal.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const rawEmail = url.searchParams.get("email");
  const token = url.searchParams.get("token")?.trim();
  const debug = process.env.NODE_ENV !== "production" || process.env.AUTH_DEBUG === "1";

  const loginRedirect = (reason: string) => {
    if (debug) console.log("[magic] reject:", reason);
    return NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));
  };

  if (!rawEmail || !token) {
    return loginRedirect("missing_params");
  }

  const email = rawEmail.toLowerCase().trim();

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Validate: unused, unexpired, and belongs to the claimed email.
    const { data: magicToken, error: tokenError } = await supabaseAdmin
      .from("magic_tokens")
      .select<string, DbMagicToken & { users: DbUser }>("*, users(*)")
      .eq("token", token)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (tokenError || !magicToken) {
      return loginRedirect("link_invalid");
    }

    const user = magicToken.users;
    if (!user || user.email !== email) {
      return loginRedirect("link_invalid");
    }

    // Consume the token (single-use). Do this before issuing the session.
    await supabaseAdmin
      .from("magic_tokens")
      .update({ used: true } as DbMagicToken)
      .eq("id", magicToken.id);

    // Mint the exact JWT NextAuth's own jwt callback would produce, then encode
    // it with the same secret + default salt that getToken()/getServerSession()
    // use to decode (see node_modules/next-auth/jwt/index.js).
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

    const res = NextResponse.redirect(new URL("/portal/villa", req.url));
    res.cookies.set({
      name: sessionCookieName,
      value: sessionJwt,
      ...sessionCookieOptions,
      maxAge: SESSION_MAX_AGE,
    });

    if (debug) {
      console.log("[magic] success:", {
        userId: user.id,
        role: user.role,
        cookie: sessionCookieName,
        secure: sessionCookieOptions.secure,
      });
    }

    return res;
  } catch (error) {
    console.error("[magic] error:", error instanceof Error ? error.message : error);
    return loginRedirect("server_error");
  }
}
