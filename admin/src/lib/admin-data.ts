import "server-only";
import { getSupabaseAdmin } from "@core/supabase";
import type {
  ApplicationRow,
  BookingRow,
  Database,
  EventRow,
  LeadRow,
  ProfileRow,
  RoomRow,
  StaffApplicationRow,
  UserRow,
  VillaRow,
} from "@core/database.types";

const db = getSupabaseAdmin;

async function count(table: keyof Database["public"]["Tables"]) {
  const { count: value } = await db().from(table).select("id", { count: "exact", head: true });
  return value || 0;
}

export async function getDashboardData() {
  const [
    applications,
    pendingRequests,
    users,
    gates,
    events,
    staff,
    upcomingRequests,
  ] = await Promise.all([
    count("applications"),
    db()
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "requested")
      .then((r) => r.count || 0),
    count("users"),
    count("villas"),
    count("events"),
    count("staff_applications"),
    db()
      .from("bookings")
      .select("*")
      .gte("check_out", new Date().toISOString().slice(0, 10))
      .order("check_in", { ascending: true })
      .limit(6)
      .then((r) => (r.data as BookingRow[]) || []),
  ]);

  return {
    metrics: [
      { label: "Applications", value: applications },
      { label: "Pending requests", value: pendingRequests },
      { label: "People", value: users },
      { label: "Gates", value: gates },
      { label: "Events", value: events },
      { label: "Staff leads", value: staff },
    ],
    upcomingRequests,
  };
}

export async function listApplications(): Promise<ApplicationRow[]> {
  const { data } = await db()
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as ApplicationRow[]) || [];
}

export async function listRequests(): Promise<
  (BookingRow & {
    room?: RoomRow | null;
    gate?: VillaRow | null;
    lead?: LeadRow | null;
    user?: UserRow | null;
  })[]
> {
  const { data: bookings } = await db()
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (bookings as BookingRow[]) || [];
  const roomIds = Array.from(new Set(rows.map((r) => r.room_id)));
  const villaIds = Array.from(new Set(rows.map((r) => r.villa_id)));
  const leadIds = Array.from(new Set(rows.map((r) => r.lead_id)));
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];

  const [rooms, gates, leads, users] = await Promise.all([
    roomIds.length ? db().from("rooms").select("*").in("id", roomIds) : Promise.resolve({ data: [] }),
    villaIds.length ? db().from("villas").select("*").in("id", villaIds) : Promise.resolve({ data: [] }),
    leadIds.length ? db().from("leads").select("*").in("id", leadIds) : Promise.resolve({ data: [] }),
    userIds.length ? db().from("users").select("*").in("id", userIds) : Promise.resolve({ data: [] }),
  ]);

  const roomMap = new Map(((rooms.data as RoomRow[]) || []).map((r) => [r.id, r]));
  const gateMap = new Map(((gates.data as VillaRow[]) || []).map((g) => [g.id, g]));
  const leadMap = new Map(((leads.data as LeadRow[]) || []).map((l) => [l.id, l]));
  const userMap = new Map(((users.data as UserRow[]) || []).map((u) => [u.id, u]));

  return rows.map((row) => ({
    ...row,
    room: roomMap.get(row.room_id) || null,
    gate: gateMap.get(row.villa_id) || null,
    lead: leadMap.get(row.lead_id) || null,
    user: row.user_id ? userMap.get(row.user_id) || null : null,
  }));
}

export async function listPeople(): Promise<
  (UserRow & { profile?: ProfileRow | null; lead?: LeadRow | null })[]
> {
  const { data: users } = await db()
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);
  const rows = (users as UserRow[]) || [];
  const userIds = rows.map((u) => u.id);
  const leadIds = Array.from(new Set(rows.map((u) => u.lead_id).filter(Boolean))) as string[];

  const [profiles, leads] = await Promise.all([
    userIds.length ? db().from("profiles").select("*").in("user_id", userIds) : Promise.resolve({ data: [] }),
    leadIds.length ? db().from("leads").select("*").in("id", leadIds) : Promise.resolve({ data: [] }),
  ]);
  const profileMap = new Map(((profiles.data as ProfileRow[]) || []).map((p) => [p.user_id, p]));
  const leadMap = new Map(((leads.data as LeadRow[]) || []).map((l) => [l.id, l]));

  return rows.map((row) => ({
    ...row,
    profile: profileMap.get(row.id) || null,
    lead: row.lead_id ? leadMap.get(row.lead_id) || null : null,
  }));
}

export async function listGates(): Promise<(VillaRow & { rooms: RoomRow[] })[]> {
  const [{ data: gates }, { data: rooms }] = await Promise.all([
    db().from("villas").select("*").order("sort_order", { ascending: true }),
    db().from("rooms").select("*").order("name", { ascending: true }),
  ]);
  const roomRows = (rooms as RoomRow[]) || [];
  return ((gates as VillaRow[]) || []).map((gate) => ({
    ...gate,
    rooms: roomRows.filter((room) => room.villa_id === gate.id),
  }));
}

export async function listEvents(): Promise<EventRow[]> {
  const { data } = await db()
    .from("events")
    .select("*")
    .order("start_at", { ascending: true })
    .limit(100);
  return (data as EventRow[]) || [];
}

export async function listStaffApplications(): Promise<StaffApplicationRow[]> {
  const { data } = await db()
    .from("staff_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as StaffApplicationRow[]) || [];
}

// ---------------------------------------------------------------- Detail + timeline

import type {
  AdminNoteRow,
  AuditLogRow,
  CrmEntityType,
  EmailMessageRow,
  EventRsvpRow,
  FollowUpRow,
  IntroRequestRow,
  PaymentRecordRow,
  ReferralCreditRow,
} from "@core/database.types";

export interface TimelineItem {
  kind: "audit" | "note" | "email";
  at: string;
  title: string;
  detail?: string | null;
  actor?: string | null;
  status?: string | null;
  /** e.g. a minted entrance link kept in the outbox row meta */
  revealLink?: string | null;
}

/** Unified activity feed for an entity: decisions, notes, and outbox rows. */
export async function getTimeline(
  entityType: CrmEntityType,
  entityId: string
): Promise<TimelineItem[]> {
  const [audits, notes, emails] = await Promise.all([
    db()
      .from("audit_logs")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => (r.data as AuditLogRow[]) || []),
    db()
      .from("admin_notes")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => (r.data as AdminNoteRow[]) || []),
    db()
      .from("email_messages")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => (r.data as EmailMessageRow[]) || []),
  ]);

  const items: TimelineItem[] = [
    ...audits.map((a) => ({
      kind: "audit" as const,
      at: a.created_at,
      title: a.summary || a.action,
      actor: a.actor_email,
    })),
    ...notes.map((n) => ({
      kind: "note" as const,
      at: n.created_at,
      title: "Note",
      detail: n.body,
      actor: n.author_email,
    })),
    ...emails.map((e) => {
      const meta = (e.meta || {}) as { magic_link?: string };
      return {
        kind: "email" as const,
        at: e.created_at,
        title: `${e.template || "email"} → ${e.to_email}`,
        detail: e.subject,
        status: e.status,
        revealLink: meta.magic_link || null,
      };
    }),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function getApplicationDetail(id: string) {
  const { data: application } = await db()
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!application) return null;
  const app = application as ApplicationRow;
  const timeline = await getTimeline("application", id);
  return { application: app, timeline };
}

export async function getRequestDetail(id: string) {
  const { data: booking } = await db().from("bookings").select("*").eq("id", id).maybeSingle();
  if (!booking) return null;
  const row = booking as BookingRow;

  const [room, gate, lead, user, timeline, payments, conflicts] = await Promise.all([
    db().from("rooms").select("*").eq("id", row.room_id).maybeSingle().then((r) => r.data as RoomRow | null),
    db().from("villas").select("*").eq("id", row.villa_id).maybeSingle().then((r) => r.data as VillaRow | null),
    db().from("leads").select("*").eq("id", row.lead_id).maybeSingle().then((r) => r.data as LeadRow | null),
    row.user_id
      ? db().from("users").select("*").eq("id", row.user_id).maybeSingle().then((r) => r.data as UserRow | null)
      : Promise.resolve(null),
    getTimeline("booking", id),
    db()
      .from("payment_records")
      .select("*")
      .eq("booking_id", id)
      .order("received_at", { ascending: false })
      .then((r) => (r.data as PaymentRecordRow[]) || []),
    db()
      .from("bookings")
      .select("id, check_in, check_out, status, companion_name")
      .eq("room_id", row.room_id)
      .neq("id", id)
      .in("status", ["approved", "deposit_paid", "paid", "confirmed"])
      .lt("check_in", row.check_out)
      .gt("check_out", row.check_in)
      .then((r) => (r.data as Pick<BookingRow, "id" | "check_in" | "check_out" | "status" | "companion_name">[]) || []),
  ]);

  const profile = row.user_id
    ? await db().from("profiles").select("*").eq("user_id", row.user_id).maybeSingle().then((r) => r.data as ProfileRow | null)
    : null;

  return { booking: row, room, gate, lead, user, profile, timeline, payments, conflicts };
}

export async function getPersonDetail(userId: string) {
  const { data: user } = await db().from("users").select("*").eq("id", userId).maybeSingle();
  if (!user) return null;
  const u = user as UserRow;

  const [profile, lead, applications, bookings, rsvps, intros, credits, suppression, timeline, followUps] =
    await Promise.all([
      db().from("profiles").select("*").eq("user_id", userId).maybeSingle().then((r) => r.data as ProfileRow | null),
      u.lead_id
        ? db().from("leads").select("*").eq("id", u.lead_id).maybeSingle().then((r) => r.data as LeadRow | null)
        : Promise.resolve(null),
      db()
        .from("applications")
        .select("*")
        .eq("email", u.email)
        .order("created_at", { ascending: false })
        .then((r) => (r.data as ApplicationRow[]) || []),
      db()
        .from("bookings")
        .select("*")
        .eq("user_id", userId)
        .order("check_in", { ascending: false })
        .then((r) => (r.data as BookingRow[]) || []),
      db()
        .from("event_rsvps")
        .select("*")
        .eq("user_id", userId)
        .then((r) => (r.data as EventRsvpRow[]) || []),
      db()
        .from("intro_requests")
        .select("*")
        .or(`from_user.eq.${userId},to_user.eq.${userId}`)
        .then((r) => (r.data as IntroRequestRow[]) || []),
      db()
        .from("referral_credits")
        .select("*")
        .eq("referrer_user_id", userId)
        .then((r) => (r.data as ReferralCreditRow[]) || []),
      db()
        .from("email_suppressions")
        .select("id, reason")
        .eq("email", u.email)
        .maybeSingle()
        .then((r) => r.data as { id: string; reason: string } | null),
      getTimeline("user", userId),
      db()
        .from("follow_ups")
        .select("*")
        .eq("entity_type", "user")
        .eq("entity_id", userId)
        .eq("status", "open")
        .then((r) => (r.data as FollowUpRow[]) || []),
    ]);

  // Emails addressed to this person, regardless of entity link.
  const { data: emailRows } = await db()
    .from("email_messages")
    .select("*")
    .eq("to_email", u.email)
    .order("created_at", { ascending: false })
    .limit(25);

  return {
    user: u,
    profile,
    lead,
    applications,
    bookings,
    rsvps,
    intros,
    credits,
    suppression,
    followUps,
    timeline,
    emails: (emailRows as EmailMessageRow[]) || [],
  };
}

export async function listOpenFollowUps(): Promise<FollowUpRow[]> {
  const { data } = await db()
    .from("follow_ups")
    .select("*")
    .eq("status", "open")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(20);
  return (data as FollowUpRow[]) || [];
}

export async function listEmailMessages(limit = 100): Promise<EmailMessageRow[]> {
  const { data } = await db()
    .from("email_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as EmailMessageRow[]) || [];
}

export async function listSuppressions(): Promise<
  { id: string; email: string; reason: string; created_at: string }[]
> {
  const { data } = await db()
    .from("email_suppressions")
    .select("id, email, reason, created_at")
    .order("created_at", { ascending: false });
  return (data as { id: string; email: string; reason: string; created_at: string }[]) || [];
}
