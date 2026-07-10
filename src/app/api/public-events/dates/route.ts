import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { DEFAULT_TIMEZONE, dateInZone } from "@core/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Event DATES only, for the application form's waiting-list calendar.
 * Includes member-only events deliberately stripped to bare dots — prospects
 * see that evenings happen at the house, never what or who.
 */
export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data } = await getSupabaseAdmin()
    .from("events")
    .select("start_at")
    .eq("status", "published")
    .gte("start_at", since)
    .limit(400);

  const marks: Record<string, { events: number }> = {};
  for (const row of (data as { start_at: string }[]) || []) {
    const { year, month, day } = dateInZone(new Date(row.start_at), DEFAULT_TIMEZONE);
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    marks[key] = { events: (marks[key]?.events || 0) + 1 };
  }
  return NextResponse.json({ marks });
}
