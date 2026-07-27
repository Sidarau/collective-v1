import * as crypto from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@core/config";
import { reconcileGoogleCalendars } from "@core/google-calendar";
import { executeCalendarAction } from "@core/calendar-actions";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  if (!config.calendarCronSecret) return false;
  const header =
    req.headers.get("x-calendar-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const expected = Buffer.from(config.calendarCronSecret);
  const actual = Buffer.from(header);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Called daily by AWS/EventBridge (or Vercel Cron during local rollout). */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await getSupabaseAdmin()
    .from("calendar_action_requests")
    .update({ status: "approved", error: "Recovered a stale execution lease" })
    .eq("status", "executing")
    .lt("updated_at", new Date(Date.now() - 5 * 60_000).toISOString());

  // Approved requests survive a transient provider outage and are retried by
  // the next run. The status claim in executeCalendarAction makes this safe.
  const { data: approved } = await getSupabaseAdmin()
    .from("calendar_action_requests")
    .select("id")
    .eq("status", "approved")
    .gt("expires_at", new Date().toISOString())
    .limit(50);
  const actions = await Promise.allSettled(
    (approved || []).map((request) => executeCalendarAction(request.id))
  );
  const calendars = await reconcileGoogleCalendars();
  return NextResponse.json({
    ok: true,
    calendars,
    actions: {
      attempted: actions.length,
      failed: actions.filter((result) => result.status === "rejected").length,
    },
  });
}
