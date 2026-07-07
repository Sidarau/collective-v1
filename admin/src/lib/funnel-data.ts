import "server-only";
import { getSupabaseAdmin } from "@core/supabase";
import type {
  ApplicationRow,
  ContentBlockRow,
  EmailCampaignRow,
  ReferralLinkRow,
  ScreeningCallRow,
  ScreeningWindowRow,
  StaffApplicationRow,
  UserRole,
} from "@core/database.types";

const db = getSupabaseAdmin;

// ---------------------------------------------------------------- Referral links

export async function listReferralLinks(): Promise<ReferralLinkRow[]> {
  const { data } = await db()
    .from("referral_links")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as ReferralLinkRow[]) || [];
}

// ---------------------------------------------------------------- Scheduling

export async function listScreeningWindows(): Promise<ScreeningWindowRow[]> {
  const { data } = await db()
    .from("screening_windows")
    .select("*")
    .order("weekday", { ascending: true, nullsFirst: false })
    .order("start_minute", { ascending: true });
  return (data as ScreeningWindowRow[]) || [];
}

export type CallWithSource = ScreeningCallRow & {
  application?: Pick<ApplicationRow, "id" | "first_name" | "last_name" | "status"> | null;
  staff_application?: Pick<StaffApplicationRow, "id" | "name" | "role_applied" | "status"> | null;
};

export async function listCalls(opts?: {
  from?: string;
  statuses?: ScreeningCallRow["status"][];
  limit?: number;
}): Promise<CallWithSource[]> {
  let query = db()
    .from("screening_calls")
    .select(
      "*, application:applications(id, first_name, last_name, status), staff_application:staff_applications(id, name, role_applied, status)"
    )
    .order("scheduled_at", { ascending: true })
    .limit(opts?.limit ?? 100);
  if (opts?.from) query = query.gte("scheduled_at", opts.from);
  if (opts?.statuses?.length) query = query.in("status", opts.statuses);
  const { data } = await query;
  return (data as unknown as CallWithSource[]) || [];
}

/** Latest scheduled call per application, for funnel list annotations. */
export async function mapLatestCalls(
  column: "application_id" | "staff_application_id",
  ids: string[]
): Promise<Map<string, ScreeningCallRow>> {
  if (!ids.length) return new Map();
  const { data } = await db()
    .from("screening_calls")
    .select("*")
    .in(column, ids)
    .order("scheduled_at", { ascending: false });
  const map = new Map<string, ScreeningCallRow>();
  for (const row of (data as ScreeningCallRow[]) || []) {
    const key = row[column];
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

// ---------------------------------------------------------------- Vendor funnel

export async function listVendorApplications(): Promise<
  (StaffApplicationRow & { call?: ScreeningCallRow | null })[]
> {
  const { data } = await db()
    .from("staff_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data as StaffApplicationRow[]) || [];
  const calls = await mapLatestCalls(
    "staff_application_id",
    rows.map((r) => r.id)
  );
  return rows.map((row) => ({ ...row, call: calls.get(row.id) || null }));
}

export async function getVendorApplication(id: string): Promise<StaffApplicationRow | null> {
  const { data } = await db().from("staff_applications").select("*").eq("id", id).maybeSingle();
  return (data as StaffApplicationRow) || null;
}

// ---------------------------------------------------------------- Campaigns + content

export async function listCampaigns(): Promise<EmailCampaignRow[]> {
  const { data } = await db()
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as EmailCampaignRow[]) || [];
}

export async function getCampaign(id: string): Promise<EmailCampaignRow | null> {
  const { data } = await db().from("email_campaigns").select("*").eq("id", id).maybeSingle();
  return (data as EmailCampaignRow) || null;
}

export interface CampaignAudience {
  roles?: string[];
  statuses?: string[];
}

/** Distinct target emails for a campaign audience (suppression runs at send). */
export async function resolveCampaignRecipients(
  audience: CampaignAudience
): Promise<{ email: string; firstName: string }[]> {
  const roles = (audience.roles?.length ? audience.roles : ["member"]) as UserRole[];
  const { data: users } = await db().from("users").select("id, email, role").in("role", roles);
  const rows = (users as { id: string; email: string; role: string }[]) || [];
  if (!rows.length) return [];

  const { data: profiles } = await db()
    .from("profiles")
    .select("user_id, first_name")
    .in(
      "user_id",
      rows.map((u) => u.id)
    );
  const nameMap = new Map(
    ((profiles as { user_id: string; first_name: string }[]) || []).map((p) => [
      p.user_id,
      p.first_name,
    ])
  );

  const seen = new Set<string>();
  const out: { email: string; firstName: string }[] = [];
  for (const user of rows) {
    const email = user.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ email, firstName: nameMap.get(user.id) || email.split("@")[0] });
  }
  return out;
}

export async function listContentBlocks(): Promise<ContentBlockRow[]> {
  const { data } = await db().from("content_blocks").select("*").order("key");
  return (data as ContentBlockRow[]) || [];
}
