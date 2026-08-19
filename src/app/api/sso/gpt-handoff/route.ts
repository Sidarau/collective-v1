import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { mintTicket } from "@/lib/sso-ticket";

export const dynamic = "force-dynamic";

const GPT_AS_BASE = () =>
  process.env.OC_GPT_AS_BASE || "https://collective-edge.fly.dev";

const STATE_RE = /^[A-Za-z0-9_\-]{8,128}$/;

/**
 * GET /api/sso/gpt-handoff?state=...
 *
 * Founder-GPT OAuth handoff. Requires a member session on opencollective.app
 * (bounces through /login?next= otherwise — the login page honours next for
 * /api/sso/* paths and returns here after magic-link/password sign-in).
 * With a session, mints the same 60s HMAC ticket as /api/sso/bridge
 * (src/lib/sso-ticket.ts, shared OC_SSO_SECRET) and 302s to the GPT
 * authorization server's /oauth/continue, which verifies the ticket and
 * completes the OAuth authorize with the member's proven identity.
 *
 * `state` is passed through untouched: it ties this handoff back to the
 * pending authorize request the AS is holding. Fixed redirect target (the AS
 * base) — no open redirect.
 */
export async function GET(request: NextRequest) {
  const rawState = request.nextUrl.searchParams.get("state") || "";
  const state = STATE_RE.test(rawState) ? rawState : "";

  const user = await getAuthUser();
  if (!user) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set(
      "next",
      `/api/sso/gpt-handoff${state ? `?state=${encodeURIComponent(state)}` : ""}`,
    );
    return NextResponse.redirect(login);
  }

  const { data } = await getSupabaseAdmin()
    .from("users")
    .select("first_name, last_name, phone, role")
    .eq("id", user.id)
    .maybeSingle();

  const name =
    [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
    user.name ||
    "";
  const ticket = mintTicket({
    sub: user.id,
    email: user.email,
    name,
    phone: data?.phone ?? "",
    role: data?.role ?? user.role,
  });

  const u = new URL(`${GPT_AS_BASE()}/oauth/continue`);
  u.searchParams.set("ticket", ticket);
  if (state) u.searchParams.set("state", state);
  return NextResponse.redirect(u);
}
