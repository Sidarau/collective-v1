import { NextRequest, NextResponse } from "next/server";
import { consumeMagicToken } from "@core/magic-consume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator entrance links (same ZEUG-414 top-level-GET pattern as the member
 * app). Non-operators are bounced by the layout guard after landing.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const result = await consumeMagicToken(
    url.searchParams.get("email"),
    url.searchParams.get("token")
  );

  if (!result.ok) {
    return NextResponse.redirect(new URL(`/login?error=${result.reason}`, req.url));
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set({
    name: result.cookie.name,
    value: result.sessionJwt,
    ...result.cookie.options,
  });
  return res;
}
