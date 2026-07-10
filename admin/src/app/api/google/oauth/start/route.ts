import * as crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/auth";
import { googleAuthUrl, isGoogleSyncConfigured } from "@core/google-calendar";
import { config } from "@core/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kick off the per-admin Google Calendar OAuth dance (two-way sync). */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.redirect(new URL("/login", req.url));
  if (!isGoogleSyncConfigured()) {
    return NextResponse.redirect(
      new URL("/schedule?error=Google+sync+needs+GOOGLE_OAUTH_CLIENT_ID%2FSECRET+first", req.url)
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${config.adminUrl || new URL(req.url).origin}/api/google/oauth/callback`;
  return NextResponse.redirect(googleAuthUrl(redirectUri, state));
}
