import * as crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/auth";
import { googleAuthUrl, isGoogleSyncConfigured } from "@core/google-calendar";
import { config } from "@core/config";
import {
  resolveCalendarOAuthInvite,
  signCalendarOAuthTarget,
} from "@core/calendar-onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kick off the per-admin Google Calendar OAuth dance (two-way sync). */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  const setupToken = new URL(req.url).searchParams.get("setup");
  const invite = setupToken ? await resolveCalendarOAuthInvite(setupToken) : null;
  if (setupToken && !invite) {
    return NextResponse.redirect(
      new URL("/calendar-connected?error=This+setup+link+expired+or+was+already+used", req.url)
    );
  }
  if (!admin && !invite) return NextResponse.redirect(new URL("/login", req.url));
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
  if (invite) {
    jar.set("gcal_oauth_target", signCalendarOAuthTarget(invite), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  } else {
    jar.delete("gcal_oauth_target");
  }

  const redirectUri = `${config.adminUrl || new URL(req.url).origin}/api/google/oauth/callback`;
  return NextResponse.redirect(googleAuthUrl(redirectUri, state));
}
