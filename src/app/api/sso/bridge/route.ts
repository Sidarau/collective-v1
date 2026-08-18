import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { mintTicket, callbackUrl } from "@/lib/sso-ticket";

export const dynamic = "force-dynamic";

/**
 * GET /api/sso/bridge?next=/pm
 *
 * The founder-facing bridge into the ClawPanel workspace. Requires a member
 * session on opencollective.app — without one we bounce through /login (the
 * login page honours ?next= and returns here after magic-link sign-in).
 * With one, we mint a 60s HMAC ticket carrying the member's profile and
 * redirect to opencollective.clawpanel.app/auth/oc/callback.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/pm";
  const safeNext = next.startsWith("/") ? next : "/pm";

  const user = await getAuthUser();
  if (!user) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("next", `/api/sso/bridge?next=${encodeURIComponent(safeNext)}`);
    return NextResponse.redirect(login);
  }

  const { data } = await getSupabaseAdmin()
    .from("users")
    .select("first_name, last_name, phone, role")
    .eq("id", user.id)
    .maybeSingle();

  const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ") || user.name || "";
  const ticket = mintTicket({
    sub: user.id,
    email: user.email,
    name,
    phone: data?.phone ?? "",
    role: data?.role ?? user.role,
  });

  return NextResponse.redirect(callbackUrl(ticket, safeNext));
}
