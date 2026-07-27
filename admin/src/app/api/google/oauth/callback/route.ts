import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/auth";
import {
  exchangeGoogleCode,
  listGoogleSources,
  saveGoogleConnection,
  syncCalendarSource,
  watchCalendarSource,
} from "@core/google-calendar";
import { writeAudit } from "@core/audit";
import { config } from "@core/config";
import {
  consumeCalendarOAuthInvite,
  validateCalendarOAuthInviteTarget,
  verifyCalendarOAuthTarget,
} from "@core/calendar-onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OAuth return leg: store the refresh token against the signed-in admin. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const sessionAdmin = await getAdminUser();
  const signedTarget = jar.get("gcal_oauth_target")?.value || "";
  const inviteTarget = signedTarget ? verifyCalendarOAuthTarget(signedTarget) : null;
  jar.delete("gcal_oauth_target");
  const inviteValid = inviteTarget
    ? await validateCalendarOAuthInviteTarget(inviteTarget.inviteId, inviteTarget.adminId)
    : false;
  if (inviteTarget && !inviteValid) {
    return NextResponse.redirect(
      new URL("/calendar-connected?error=This+setup+link+expired+before+Google+finished", req.url)
    );
  }
  const adminId = inviteTarget ? inviteTarget.adminId : sessionAdmin?.id;
  if (!adminId) return NextResponse.redirect(new URL("/login", req.url));

  const expected = jar.get("gcal_oauth_state")?.value;
  jar.delete("gcal_oauth_state");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(
      new URL(
        inviteTarget
          ? "/calendar-connected?error=Google+connection+was+cancelled"
          : "/schedule?error=Google+connection+was+cancelled+—+try+again",
        req.url
      )
    );
  }

  const redirectUri = `${config.adminUrl || url.origin}/api/google/oauth/callback`;
  const { refreshToken, email, scopes } = await exchangeGoogleCode(code, redirectUri);
  if (!refreshToken) {
    return NextResponse.redirect(
      new URL(
        inviteTarget
          ? "/calendar-connected?error=Google+did+not+finish+the+connection"
          : "/schedule?error=Google+did+not+return+a+refresh+token+—+try+again",
        req.url
      )
    );
  }

  await saveGoogleConnection(adminId, refreshToken, email, scopes);
  const selected = (await listGoogleSources(adminId)).filter((source) => source.selected);
  await Promise.allSettled(
    selected.map(async (source) => {
      await syncCalendarSource(source.id);
      if (config.googleCalendarWebhookUrl) await watchCalendarSource(source.id);
    })
  );
  await writeAudit({
    actorId: sessionAdmin?.id || adminId,
    actorEmail: sessionAdmin?.email || email,
    action: "gcal.connected",
    entityType: "user",
    entityId: adminId,
    summary: `Google Calendar two-way sync connected${email ? ` (${email})` : ""}`,
  });
  if (inviteTarget && inviteValid) {
    await consumeCalendarOAuthInvite(inviteTarget.inviteId);
  }

  return NextResponse.redirect(
    new URL(inviteTarget && inviteValid ? "/calendar-connected" : "/schedule", req.url)
  );
}
