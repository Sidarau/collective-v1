import "server-only";
import { getSupabaseAdmin } from "@core/supabase";
import type {
  ApplicationRow,
  ReferralLinkRow,
  ScreeningCallRow,
  StaffApplicationRow,
} from "@core/database.types";

const db = getSupabaseAdmin;

/** Whose scheduling page a token opens (member screening vs vendor interview). */
export interface ScreeningContext {
  kind: "member" | "vendor";
  firstName: string;
  email: string;
  applicationId: string | null;
  staffApplicationId: string | null;
  existingCall: ScreeningCallRow | null;
}

export async function resolveScreeningToken(token: string): Promise<ScreeningContext | null> {
  if (!token || token.length < 16) return null;

  const { data: application } = await db()
    .from("applications")
    .select("*")
    .eq("screening_token", token)
    .maybeSingle();

  if (application) {
    const app = application as ApplicationRow;
    return {
      kind: "member",
      firstName: app.first_name,
      email: app.email,
      applicationId: app.id,
      staffApplicationId: null,
      existingCall: await latestScheduledCall("application_id", app.id),
    };
  }

  const { data: staff } = await db()
    .from("staff_applications")
    .select("*")
    .eq("interview_token", token)
    .maybeSingle();

  if (staff) {
    const row = staff as StaffApplicationRow;
    return {
      kind: "vendor",
      firstName: row.name.split(" ")[0] || row.name,
      email: row.email,
      applicationId: null,
      staffApplicationId: row.id,
      existingCall: await latestScheduledCall("staff_application_id", row.id),
    };
  }

  return null;
}

async function latestScheduledCall(
  column: "application_id" | "staff_application_id",
  id: string
): Promise<ScreeningCallRow | null> {
  const { data } = await db()
    .from("screening_calls")
    .select("*")
    .eq(column, id)
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ScreeningCallRow) || null;
}

/** Active referral link for a public funnel page; null when the door is closed. */
export async function loadActiveReferralLink(
  code: string,
  kind: "member" | "vendor"
): Promise<ReferralLinkRow | null> {
  const { data } = await db()
    .from("referral_links")
    .select("*")
    .eq("code", code.toLowerCase())
    .eq("kind", kind)
    .eq("active", true)
    .maybeSingle();
  const link = (data as ReferralLinkRow) || null;
  if (!link) return null;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;
  if (link.max_uses != null && link.use_count >= link.max_uses) return null;
  return link;
}

/** Villa-local, human date-time for emails and confirmations. */
export function fmtCallTime(iso: string, timeZone: string): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))} (Ibiza time)`;
}
