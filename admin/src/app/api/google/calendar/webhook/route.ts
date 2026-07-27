import { NextResponse } from "next/server";
import { resolveWebhookSource, syncCalendarSource } from "@core/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Google sends identifiers in X-Goog-* headers and no useful body. A random
 * per-channel token is verified before any sync work begins.
 */
export async function POST(req: Request) {
  const sourceId = await resolveWebhookSource(req.headers);
  if (!sourceId) return NextResponse.json({ error: "Unknown calendar channel" }, { status: 401 });

  const state = req.headers.get("x-goog-resource-state");
  // "sync" is Google's handshake notification. The OAuth callback already
  // performed the initial pull, so a second full pull is unnecessary.
  if (state !== "sync") await syncCalendarSource(sourceId);
  return new NextResponse(null, { status: 204 });
}
