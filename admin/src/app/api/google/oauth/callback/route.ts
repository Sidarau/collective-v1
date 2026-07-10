import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/auth";
import { exchangeGoogleCode, saveGoogleConnection } from "@core/google-calendar";
import { writeAudit } from "@core/audit";
import { config } from "@core/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OAuth return leg: store the refresh token against the signed-in admin. */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("gcal_oauth_state")?.value;
  jar.delete("gcal_oauth_state");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(
      new URL("/schedule?error=Google+connection+was+cancelled+—+try+again", req.url)
    );
  }

  const redirectUri = `${config.adminUrl || url.origin}/api/google/oauth/callback`;
  const { refreshToken, email } = await exchangeGoogleCode(code, redirectUri);
  if (!refreshToken) {
    return NextResponse.redirect(
      new URL("/schedule?error=Google+did+not+return+a+refresh+token+—+try+again", req.url)
    );
  }

  await saveGoogleConnection(admin.id, refreshToken, email);
  await writeAudit({
    action: "gcal.connected",
    entityType: "user",
    entityId: admin.id,
    summary: `Google Calendar two-way sync connected${email ? ` (${email})` : ""}`,
  });

  return NextResponse.redirect(new URL("/schedule", req.url));
}
