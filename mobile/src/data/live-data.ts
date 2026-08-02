import "server-only";

/**
 * Live data layer for the mobile operator surface.
 *
 * Raw Supabase reads + the aggregations the provider needs. Everything goes
 * through the service-role client on the server (never the browser); the
 * session guard above this layer is what authorizes the operator, and RLS is
 * bypassed deliberately the same way the admin console does it.
 */

import { getSupabaseAdmin } from "@core/supabase";
import type {
  AgentTokenRow,
  ApplicationRow,
  BookingRow,
  ContentBlockRow,
  EmailCampaignRow,
  EventRow,
  EventRsvpRow,
  FollowUpRow,
  KbNodeRow,
  LeadRow,
  PaymentRecordRow,
  ProfileRow,
  RoomRow,
  ScreeningCallRow,
  StaffApplicationRow,
  UserRow,
  VillaRow,
} from "@core/database.types";
import {
  mapApplicationToEvent,
  mapApplicationToRequest,
  mapBookingToArrivalEvent,
  mapBookingToDepartureEvent,
  mapBookingToOutstanding,
  mapBookingToRequest,
  mapEventToTimelineEvent,
  mapFollowUpToEvent,
  mapFollowUpToRequest,
  mapOutstandingToEvent,
  mapPaymentToEvent,
  mapPaymentToTransaction,
  mapScreeningCallToEvent,
  mapStaffToVendor,
  personName,
  toMinor,
  type RequestJoins,
} from "./mappers";
import type {
  AccessRequest,
  AgentEntry,
  Communication,
  ContentItem,
  Experience,
  Gate,
  KnowledgeNode,
  Metric,
  NumbersPeriod,
  OperationEvent,
  Person,
  PersonRelationship,
  ReportSummary,
  Space,
  Transaction,
  Vendor,
} from "./contracts";
import {
  mapCampaignToCommunication,
  mapContentBlock,
  mapEventToExperience,
  mapKbNode,
  mapRoomToArea,
  mapUserToPerson,
  mapVillaToGate,
  mapVillaToSpace,
  relationshipOf,
  dayOf,
} from "./mappers";

const db = getSupabaseAdmin;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function periodStart(period: NumbersPeriod, nowIso: string): string {
  const now = Date.parse(nowIso);
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  return new Date(now - (days - 1) * DAY_MS).toISOString();
}

export async function fetchVillas(): Promise<VillaRow[]> {
  const { data } = await db().from("villas").select("*").order("sort_order", { ascending: true });
  return (data as VillaRow[]) || [];
}

export async function fetchRooms(): Promise<RoomRow[]> {
  const { data } = await db().from("rooms").select("*").order("name", { ascending: true });
  return (data as RoomRow[]) || [];
}

export async function fetchBookings(): Promise<BookingRow[]> {
  const { data } = await db()
    .from("bookings")
    .select("*")
    .order("check_in", { ascending: false })
    .limit(300);
  return (data as BookingRow[]) || [];
}

export async function fetchApplications(): Promise<ApplicationRow[]> {
  const { data } = await db()
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as ApplicationRow[]) || [];
}

export async function fetchFollowUps(): Promise<FollowUpRow[]> {
  const { data } = await db()
    .from("follow_ups")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(100);
  return (data as FollowUpRow[]) || [];
}

export async function fetchScreeningCalls(): Promise<ScreeningCallRow[]> {
  const { data } = await db()
    .from("screening_calls")
    .select("*")
    .order("scheduled_at", { ascending: false })
    .limit(100);
  return (data as ScreeningCallRow[]) || [];
}

export async function fetchEvents(): Promise<EventRow[]> {
  const { data } = await db()
    .from("events")
    .select("*")
    .order("start_at", { ascending: false })
    .limit(150);
  return (data as EventRow[]) || [];
}

export async function fetchRsvps(): Promise<EventRsvpRow[]> {
  const { data } = await db().from("event_rsvps").select("*");
  return (data as EventRsvpRow[]) || [];
}

export async function fetchPayments(): Promise<PaymentRecordRow[]> {
  const { data } = await db()
    .from("payment_records")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(300);
  return (data as PaymentRecordRow[]) || [];
}

export async function fetchUsers(): Promise<UserRow[]> {
  const { data } = await db()
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as UserRow[]) || [];
}

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data } = await db().from("profiles").select("*");
  return (data as ProfileRow[]) || [];
}

export async function fetchLeads(): Promise<LeadRow[]> {
  const { data } = await db().from("leads").select("*").limit(300);
  return (data as LeadRow[]) || [];
}

export async function fetchStaffApplications(): Promise<StaffApplicationRow[]> {
  const { data } = await db()
    .from("staff_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as StaffApplicationRow[]) || [];
}

export async function fetchCampaigns(): Promise<EmailCampaignRow[]> {
  const { data } = await db()
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as EmailCampaignRow[]) || [];
}

export async function fetchContentBlocks(): Promise<ContentBlockRow[]> {
  const { data } = await db()
    .from("content_blocks")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data as ContentBlockRow[]) || [];
}

export async function fetchKbNodes(): Promise<KbNodeRow[]> {
  const { data } = await db()
    .from("kb_nodes")
    .select("*")
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data as KbNodeRow[]) || [];
}

export async function fetchAgentTokens(): Promise<AgentTokenRow[]> {
  const { data } = await db()
    .from("agent_tokens")
    .select("id, label, scope, revoked_at, last_used_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as AgentTokenRow[]) || [];
}

export async function fetchClosures(): Promise<{ villa_id: string | null; room_id: string | null; starts_on: string; ends_on: string | null }[]> {
  const { data } = await db()
    .from("closure_periods")
    .select("villa_id, room_id, starts_on, ends_on");
  return (data as { villa_id: string | null; room_id: string | null; starts_on: string; ends_on: string | null }[]) || [];
}

/* ------------------------------------------------------------------ *
 * Joined/assembled shapes
 * ------------------------------------------------------------------ */

export interface CoreData {
  villas: VillaRow[];
  rooms: RoomRow[];
  bookings: BookingRow[];
  applications: ApplicationRow[];
  followUps: FollowUpRow[];
  screeningCalls: ScreeningCallRow[];
  events: EventRow[];
  rsvps: EventRsvpRow[];
  payments: PaymentRecordRow[];
  users: UserRow[];
  profiles: ProfileRow[];
  leads: LeadRow[];
  staff: StaffApplicationRow[];
  closures: Awaited<ReturnType<typeof fetchClosures>>;
}

/** One fan-out for the read models that need most of the schema. */
export async function fetchCoreData(): Promise<CoreData> {
  const [
    villas, rooms, bookings, applications, followUps, screeningCalls,
    events, rsvps, payments, users, profiles, leads, staff, closures,
  ] = await Promise.all([
    fetchVillas(), fetchRooms(), fetchBookings(), fetchApplications(),
    fetchFollowUps(), fetchScreeningCalls(), fetchEvents(), fetchRsvps(),
    fetchPayments(), fetchUsers(), fetchProfiles(), fetchLeads(),
    fetchStaffApplications(), fetchClosures(),
  ]);
  return { villas, rooms, bookings, applications, followUps, screeningCalls, events, rsvps, payments, users, profiles, leads, staff, closures };
}

export function leadMap(leads: LeadRow[]): Map<string, LeadRow> {
  return new Map(leads.map((l) => [l.id, l]));
}
export function userMap(users: UserRow[]): Map<string, UserRow> {
  return new Map(users.map((u) => [u.id, u]));
}
export function profileMap(profiles: ProfileRow[]): Map<string, ProfileRow> {
  return new Map(profiles.map((p) => [p.user_id, p]));
}
export function villaMap(villas: VillaRow[]): Map<string, VillaRow> {
  return new Map(villas.map((v) => [v.id, v]));
}
export function roomMap(rooms: RoomRow[]): Map<string, RoomRow> {
  return new Map(rooms.map((r) => [r.id, r]));
}
export function eventMap(events: EventRow[]): Map<string, EventRow> {
  return new Map(events.map((e) => [e.id, e]));
}
export function bookingMap(bookings: BookingRow[]): Map<string, BookingRow> {
  return new Map(bookings.map((b) => [b.id, b]));
}

export function joinsFor(row: BookingRow, core: CoreData): RequestJoins {
  return {
    lead: leadMap(core.leads).get(row.lead_id) ?? null,
    user: row.user_id ? userMap(core.users).get(row.user_id) ?? null : null,
    gate: villaMap(core.villas).get(row.villa_id) ?? null,
    room: roomMap(core.rooms).get(row.room_id) ?? null,
  };
}

/** Payments summed per booking (minor units). */
export function paidByBooking(payments: PaymentRecordRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of payments) {
    if (p.kind === "refund") continue;
    map.set(p.booking_id, (map.get(p.booking_id) ?? 0) + toMinor(p.amount));
  }
  return map;
}

export function buildTransactions(core: CoreData): Transaction[] {
  const bookings = bookingMap(core.bookings);
  const paid = paidByBooking(core.payments);
  const out: Transaction[] = [];

  for (const p of core.payments) {
    const booking = bookings.get(p.booking_id) ?? null;
    const person = booking ? personName(joinsFor(booking, core).lead, null) : null;
    out.push(mapPaymentToTransaction(p, booking, person));
  }
  for (const b of core.bookings) {
    if (["cancelled", "completed", "inquiry"].includes(b.status)) continue;
    const person = personName(joinsFor(b, core).lead, null);
    const tx = mapBookingToOutstanding(b, paid.get(b.id) ?? 0, person);
    if (tx) out.push(tx);
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function buildRequests(core: CoreData): AccessRequest[] {
  const rows: AccessRequest[] = [
    ...core.applications.map(mapApplicationToRequest),
    ...core.bookings.map((b) => mapBookingToRequest(b, joinsFor(b, core))),
    ...core.followUps.map((f) =>
      mapFollowUpToRequest(f, f.entity_type === "lead" && f.entity_id ? leadMap(core.leads).get(f.entity_id) ?? null : null),
    ),
  ];
  return rows.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
}

export function buildTimelineEvents(core: CoreData, nowIso: string): OperationEvent[] {
  const villas = villaMap(core.villas);
  const events: OperationEvent[] = [];

  const windowStart = new Date(Date.parse(nowIso) - 30 * DAY_MS).toISOString();
  const windowEnd = new Date(Date.parse(nowIso) + 60 * DAY_MS).toISOString();
  const inWindow = (iso: string) => iso >= windowStart && iso <= windowEnd;

  for (const b of core.bookings) {
    if (["inquiry", "cancelled"].includes(b.status)) continue;
    const joins = joinsFor(b, core);
    if (inWindow(`${dayOf(b.check_in)}T12:00:00.000Z`)) events.push(mapBookingToArrivalEvent(b, joins));
    if (inWindow(`${dayOf(b.check_out)}T11:00:00.000Z`)) events.push(mapBookingToDepartureEvent(b, joins));
  }
  for (const a of core.applications) {
    if (inWindow(a.created_at)) events.push(mapApplicationToEvent(a));
  }
  for (const c of core.screeningCalls) {
    if (inWindow(c.scheduled_at)) events.push(mapScreeningCallToEvent(c));
  }
  for (const f of core.followUps) {
    if (f.status === "open" || (f.due_at && inWindow(f.due_at))) events.push(mapFollowUpToEvent(f, nowIso));
  }
  for (const e of core.events) {
    if (inWindow(e.start_at)) {
      events.push(mapEventToTimelineEvent(e, e.villa_id ? villas.get(e.villa_id)?.name : undefined));
    }
  }
  for (const p of core.payments) {
    if (inWindow(p.received_at)) {
      const booking = bookingMap(core.bookings).get(p.booking_id) ?? null;
      events.push(mapPaymentToEvent(p, booking ? personName(joinsFor(booking, core).lead, null) : null));
    }
  }
  // Outstanding money is work, not history: always visible, carried when overdue.
  for (const tx of buildTransactions(core)) {
    if (tx.settlement !== "outstanding") continue;
    events.push(mapOutstandingToEvent(tx, nowIso));
  }
  return events;
}

export function buildSpaces(core: CoreData, nowIso: string): Space[] {
  const roomsByVilla = new Map<string, RoomRow[]>();
  for (const r of core.rooms) {
    roomsByVilla.set(r.villa_id, [...(roomsByVilla.get(r.villa_id) ?? []), r]);
  }
  const today = dayOf(nowIso);
  const activeClosures = core.closures.filter(
    (c) => c.starts_on <= today && (!c.ends_on || c.ends_on >= today),
  );

  const upcomingEvents = [...core.events]
    .filter((e) => e.start_at >= nowIso && e.status === "published")
    .sort((a, b) => (a.start_at < b.start_at ? -1 : 1));

  return core.villas.map((villa) => {
    const rooms = roomsByVilla.get(villa.id) ?? [];
    const areas = rooms.map((room) => {
      const occupied = core.bookings.some(
        (b) =>
          b.room_id === room.id &&
          ["approved", "deposit_paid", "paid", "confirmed"].includes(b.status) &&
          dayOf(b.check_in) <= today &&
          dayOf(b.check_out) >= today,
      );
      const closed = activeClosures.some((c) => c.room_id === room.id || (c.villa_id === villa.id && !c.room_id));
      return mapRoomToArea(room, occupied ? "in_use" : "ready", closed);
    });

    const peopleOnSite = core.bookings
      .filter(
        (b) =>
          b.villa_id === villa.id &&
          ["approved", "deposit_paid", "paid", "confirmed"].includes(b.status) &&
          dayOf(b.check_in) <= today &&
          dayOf(b.check_out) >= today,
      )
      .reduce((n, b) => n + (b.guests ?? 1), 0);

    // Utilization: booked room-nights in the next 30 days over available.
    const horizonEnd = dayOf(new Date(Date.parse(nowIso) + 30 * DAY_MS).toISOString());
    let bookedNights = 0;
    for (const b of core.bookings) {
      if (b.villa_id !== villa.id || !["approved", "deposit_paid", "paid", "confirmed"].includes(b.status)) continue;
      const start = dayOf(b.check_in) < today ? today : dayOf(b.check_in);
      const end = dayOf(b.check_out) > horizonEnd ? horizonEnd : dayOf(b.check_out);
      const nights = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS));
      bookedNights += nights;
    }
    const capacity = Math.max(rooms.length, 1) * 30;
    const utilizationPct = Math.min(100, Math.round((bookedNights / capacity) * 100));

    const next = upcomingEvents.find((e) => e.villa_id === villa.id);
    return mapVillaToSpace(
      villa,
      areas,
      peopleOnSite,
      utilizationPct,
      next ? `${next.title} · ${dayOf(next.start_at)}` : undefined,
    );
  });
}

export function buildGates(core: CoreData, requests: AccessRequest[]): Gate[] {
  const openByVilla = new Map<string, number>();
  for (const b of core.bookings) {
    if (b.status === "requested") openByVilla.set(b.villa_id, (openByVilla.get(b.villa_id) ?? 0) + 1);
  }
  void requests;
  return core.villas.map((villa) => {
    const open = openByVilla.get(villa.id) ?? 0;
    return mapVillaToGate(
      villa,
      [`space-${villa.id}`],
      open,
      open ? `${open} open ${open === 1 ? "request" : "requests"}` : "No open requests",
    );
  });
}

export function buildPeople(core: CoreData): Person[] {
  const profiles = profileMap(core.profiles);
  const leads = leadMap(core.leads);
  const applicationsByEmail = new Map<string, ApplicationRow[]>();
  for (const a of core.applications) {
    applicationsByEmail.set(a.email.toLowerCase(), [...(applicationsByEmail.get(a.email.toLowerCase()) ?? []), a]);
  }
  const upcomingByUser = new Map<string, number>();
  const today = dayOf(new Date().toISOString());
  for (const b of core.bookings) {
    if (b.user_id && ["approved", "deposit_paid", "paid", "confirmed"].includes(b.status) && dayOf(b.check_out) >= today) {
      upcomingByUser.set(b.user_id, (upcomingByUser.get(b.user_id) ?? 0) + 1);
    }
  }
  const expByUser = new Map<string, number>();
  for (const r of core.rsvps) {
    if (r.status === "going") expByUser.set(r.user_id, (expByUser.get(r.user_id) ?? 0) + 1);
  }

  return core.users.map((u) => {
    const applications = applicationsByEmail.get(u.email.toLowerCase()) ?? [];
    const relationship: PersonRelationship = relationshipOf(u, applications);
    const person = mapUserToPerson(
      u,
      profiles.get(u.id) ?? null,
      u.lead_id ? leads.get(u.lead_id) ?? null : null,
      relationship,
      upcomingByUser.get(u.id) ?? 0,
      expByUser.get(u.id) ?? 0,
    );
    person.email = u.email;
    const pending = applications.find((a) => a.status === "submitted" || a.status === "screening");
    if (pending) person.pendingApplicationId = pending.id;
    return person;
  });
}

export function buildVendors(core: CoreData): Vendor[] {
  return core.staff.map((s) => mapStaffToVendor(s));
}

export function buildExperiences(core: CoreData): Experience[] {
  const villas = villaMap(core.villas);
  const rsvpCount = new Map<string, number>();
  for (const r of core.rsvps) {
    if (r.status === "going") rsvpCount.set(r.event_id, (rsvpCount.get(r.event_id) ?? 0) + 1);
  }
  return [...core.events]
    .sort((a, b) => (a.start_at < b.start_at ? 1 : -1))
    .map((e) =>
      mapEventToExperience(
        e,
        e.villa_id ? villas.get(e.villa_id)?.name ?? "Network" : "Network",
        rsvpCount.get(e.id) ?? 0,
      ),
    );
}

export function buildCommunications(campaigns: EmailCampaignRow[]): Communication[] {
  return campaigns.map(mapCampaignToCommunication);
}

export function buildContent(blocks: ContentBlockRow[]): ContentItem[] {
  return blocks.map(mapContentBlock);
}

export function buildKnowledge(nodes: KbNodeRow[]): KnowledgeNode[] {
  return nodes.filter((n) => n.visibility !== "internal").map(mapKbNode);
}

export function buildAgents(tokens: AgentTokenRow[]): AgentEntry[] {
  return tokens.map((t) => ({
    id: `agent-${t.id}`,
    name: t.label,
    detail: t.revoked_at
      ? "Revoked"
      : t.last_used_at
        ? `Last active ${dayOf(t.last_used_at)}`
        : "Never used",
    state: t.revoked_at
      ? { label: "Revoked", tone: "neutral" as const }
      : { label: "Active", tone: "healthy" as const },
    scopes: [t.scope],
  }));
}

const eur = (minor: number) =>
  `€${(minor / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

export function buildNumbers(core: CoreData, period: NumbersPeriod, nowIso: string) {
  const start = periodStart(period, nowIso);
  const paid = paidByBooking(core.payments);

  const paymentsIn = core.payments.filter((p) => p.received_at >= start && p.received_at <= nowIso);
  const receivedMinor = paymentsIn.reduce((n, p) => n + toMinor(p.amount) * (p.kind === "refund" ? -1 : 1), 0);

  let confirmedMinor = 0;
  let outstandingMinor = 0;
  for (const b of core.bookings) {
    if (["inquiry", "cancelled"].includes(b.status)) continue;
    if (dayOf(b.check_in) > dayOf(nowIso)) continue; // future access isn't due yet
    const total = toMinor(b.total_price);
    const settled = paid.get(b.id) ?? 0;
    confirmedMinor += Math.min(total, settled);
    outstandingMinor += Math.max(0, total - settled);
  }

  // Forecast: expected contribution of confirmed access starting inside the
  // window that has not been settled yet. Kept strictly separate.
  const windowEnd = new Date(Date.parse(nowIso) + (period === "today" ? 1 : period === "7d" ? 7 : 30) * DAY_MS).toISOString();
  let forecastMinor = 0;
  for (const b of core.bookings) {
    if (!["approved", "deposit_paid", "paid", "confirmed"].includes(b.status)) continue;
    if (dayOf(b.check_in) < dayOf(nowIso) || b.check_in > windowEnd) continue;
    forecastMinor += Math.max(0, toMinor(b.total_price) - (paid.get(b.id) ?? 0));
  }

  const newApplications = core.applications.filter((a) => a.created_at >= start).length;
  const openRequests = core.bookings.filter((b) => b.status === "requested").length;

  const metrics: Metric[] = [
    { key: "received", label: "Received", value: eur(receivedMinor), raw: receivedMinor, kind: "confirmed" },
    { key: "outstanding", label: "Outstanding", value: eur(outstandingMinor), raw: outstandingMinor, kind: "outstanding" },
    { key: "forecast", label: "Forecast", value: eur(forecastMinor), raw: forecastMinor, kind: "forecast" },
    { key: "applications", label: "New applications", value: String(newApplications), raw: newApplications, kind: "count" },
    { key: "requests", label: "Open requests", value: String(openRequests), raw: openRequests, kind: "count" },
  ];
  void confirmedMinor;
  return { period, asOf: nowIso, metrics };
}

export function buildForecastSeries(core: CoreData, period: NumbersPeriod, nowIso: string) {
  const days = period === "today" ? 7 : period === "7d" ? 14 : 30;
  const paid = paidByBooking(core.payments);
  const points = [];
  const startMs = Date.parse(`${dayOf(nowIso)}T00:00:00Z`);
  let confirmedMinor = 0;
  let outstandingMinor = 0;
  let forecastMinor = 0;

  for (let i = 0; i < days; i++) {
    const dayIso = dayOf(new Date(startMs + (i - Math.floor(days / 2)) * DAY_MS).toISOString());
    const dayStart = `${dayIso}T00:00:00.000Z`;
    const dayEnd = `${dayIso}T23:59:59.999Z`;

    const settled = core.payments
      .filter((p) => p.received_at >= dayStart && p.received_at <= dayEnd && p.kind !== "refund")
      .reduce((n, p) => n + toMinor(p.amount), 0);

    const projected = core.bookings
      .filter(
        (b) =>
          ["approved", "deposit_paid", "paid", "confirmed"].includes(b.status) &&
          dayOf(b.check_in) === dayIso,
      )
      .reduce((n, b) => n + Math.max(0, toMinor(b.total_price) - (paid.get(b.id) ?? 0)), 0);

    const past = dayIso <= dayOf(nowIso);
    points.push({
      isoDate: dayIso,
      settledMinor: past ? settled : null,
      projectedMinor: past ? null : projected,
    });
    if (past) confirmedMinor += settled;
    else forecastMinor += projected;
  }

  for (const b of core.bookings) {
    if (["inquiry", "cancelled"].includes(b.status)) continue;
    outstandingMinor += Math.max(0, toMinor(b.total_price) - (paid.get(b.id) ?? 0));
  }

  return {
    currency: "EUR",
    points,
    todayIndex: Math.floor(days / 2),
    forecastMinor,
    confirmedMinor,
    outstandingMinor,
  };
}

export function buildReports(core: CoreData, nowIso: string): ReportSummary[] {
  const thirty = buildNumbers(core, "30d", nowIso);
  const spaces = buildSpaces(core, nowIso);
  return [
    {
      id: "report-money",
      title: "Money, last 30 days",
      detail: "Received, outstanding and forecast across all Gates.",
      metrics: thirty.metrics.filter((m) => ["received", "outstanding", "forecast"].includes(m.key)),
    },
    {
      id: "report-utilization",
      title: "Space utilization",
      detail: "Booked room-nights over the next 30 days.",
      metrics: spaces.map((s) => ({
        key: s.id,
        label: s.name,
        value: `${s.utilizationPct}%`,
        raw: s.utilizationPct,
        kind: "ratio" as const,
      })),
    },
    {
      id: "report-pipeline",
      title: "Access pipeline",
      detail: "Applications and open requests right now.",
      metrics: thirty.metrics.filter((m) => ["applications", "requests"].includes(m.key)),
    },
  ];
}
