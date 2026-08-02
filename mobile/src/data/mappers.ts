/**
 * Supabase → contract mappers for the mobile operator surface.
 *
 * Pure functions, one per domain record. They own the access-network
 * presentation language (never "booking"/"villa"/"guest" in copy), the
 * displayPrecision truthfulness rules from PHASE_2_HANDOFF.md, and the
 * fixture id shapes (req-*, space-*, tx-*, …) so Phase 1 deep links keep
 * working unchanged against real data.
 */

import type {
  AccessRequest,
  ActivityEntry,
  AgentEntry,
  Area,
  Communication,
  ContentItem,
  DaySummary,
  Experience,
  Gate,
  KnowledgeNode,
  Metric,
  MoneyDirection,
  OperationEvent,
  OperatorAccount,
  Person,
  PersonRelationship,
  RecordState,
  ReportSummary,
  Space,
  Transaction,
  Vendor,
} from "./contracts";
import type {
  ApplicationRow,
  BookingRow,
  EmailCampaignRow,
  EventRow,
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

export const CURRENCY = "EUR";

/** Whole units in the schema → minor units in the contracts. */
export const toMinor = (amount: number | null | undefined): number =>
  Math.round((amount ?? 0) * 100);

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function personName(lead?: LeadRow | null, fallbackEmail?: string | null): string {
  if (lead) {
    const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
    if (name) return name;
  }
  return fallbackEmail?.split("@")[0] ?? "Unknown";
}

export function profileName(profile?: ProfileRow | null, email?: string | null): string {
  if (profile) {
    const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    if (name) return name;
  }
  return email?.split("@")[0] ?? "Unknown";
}

/* ------------------------------------------------------------------ *
 * State chips
 * ------------------------------------------------------------------ */

const BOOKING_STATE: Record<string, RecordState> = {
  inquiry: { label: "Inquiry", tone: "neutral" },
  requested: { label: "Needs review", tone: "attention" },
  waitlisted: { label: "Waitlisted", tone: "neutral" },
  approved: { label: "Approved", tone: "healthy" },
  deposit_paid: { label: "Deposit received", tone: "healthy" },
  paid: { label: "Paid", tone: "healthy" },
  confirmed: { label: "Confirmed", tone: "healthy" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  completed: { label: "Complete", tone: "neutral" },
};

const APPLICATION_STATE: Record<string, RecordState> = {
  submitted: { label: "New", tone: "attention" },
  screening: { label: "Screening", tone: "neutral" },
  approved: { label: "Approved", tone: "healthy" },
  rejected: { label: "Declined", tone: "neutral" },
  waitlist: { label: "Waitlist", tone: "neutral" },
};

const STAFF_STATE: Record<string, RecordState> = {
  submitted: { label: "New", tone: "attention" },
  review: { label: "In review", tone: "neutral" },
  interview_scheduled: { label: "Interview set", tone: "neutral" },
  interviewed: { label: "Interviewed", tone: "neutral" },
  shortlisted: { label: "Shortlisted", tone: "healthy" },
  rejected: { label: "Declined", tone: "neutral" },
  hired: { label: "Hired", tone: "healthy" },
};

const EVENT_STATE: Record<string, RecordState> = {
  draft: { label: "Draft", tone: "attention" },
  published: { label: "Published", tone: "healthy" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const CAMPAIGN_STATE: Record<string, RecordState> = {
  draft: { label: "Draft", tone: "attention" },
  sending: { label: "Sending", tone: "neutral" },
  sent: { label: "Sent", tone: "healthy" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

/** YYYY-MM-DD in UTC — schema dates are day strings, datetimes are ISO. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function formatPeriod(checkIn: string, checkOut: string): string {
  const inD = new Date(`${dayOf(checkIn)}T00:00:00Z`);
  const outD = new Date(`${dayOf(checkOut)}T00:00:00Z`);
  const month = (d: Date) => d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  if (month(inD) === month(outD)) {
    return `${inD.getUTCDate()}–${outD.getUTCDate()} ${month(inD)}`;
  }
  return `${inD.getUTCDate()} ${month(inD)} – ${outD.getUTCDate()} ${month(outD)}`;
}

/* ------------------------------------------------------------------ *
 * Requests — applications, access requests, follow-ups
 * ------------------------------------------------------------------ */

export type RequestJoins = {
  lead?: LeadRow | null;
  user?: UserRow | null;
  gate?: VillaRow | null;
  room?: RoomRow | null;
};

export function mapApplicationToRequest(row: ApplicationRow): AccessRequest {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email.split("@")[0];
  return {
    id: `req-app-${row.id}`,
    personName: name,
    personId: row.user_id ? `person-${row.user_id}` : `req-app-${row.id}`,
    avatarInitials: initialsOf(name),
    kind: "application",
    gateName: "Membership",
    spaceName: "Network",
    periodLabel: row.preferred_window ?? "Timing open",
    people: 1,
    currency: CURRENCY,
    state: APPLICATION_STATE[row.status] ?? { label: row.status, tone: "neutral" },
    submittedAt: row.created_at,
    introducedBy: row.referred_by ?? undefined,
    notes: row.motivation ?? undefined,
    checklist: [],
    activity: [],
  };
}

export function mapBookingToRequest(row: BookingRow, joins: RequestJoins): AccessRequest {
  const name = personName(joins.lead, joins.user?.email ?? null);
  const priceMinor = toMinor(row.total_price);
  return {
    id: `req-bk-${row.id}`,
    personName: name,
    personId: row.user_id ? `person-${row.user_id}` : joins.lead ? `lead-${joins.lead.id}` : `req-bk-${row.id}`,
    avatarInitials: initialsOf(name),
    kind: "access_request",
    gateName: joins.gate?.name ?? "Gate",
    spaceName: joins.room?.name ?? joins.gate?.name ?? "Space",
    periodLabel: formatPeriod(row.check_in, row.check_out),
    people: row.guests ?? 1,
    expectedContributionMinor: priceMinor > 0 ? priceMinor : undefined,
    currency: row.currency || CURRENCY,
    state: BOOKING_STATE[row.status] ?? { label: row.status, tone: "neutral" },
    submittedAt: row.created_at,
    notes: row.special_requests ?? undefined,
    checklist: [],
    activity: [],
  };
}

export function mapFollowUpToRequest(row: FollowUpRow, lead?: LeadRow | null): AccessRequest {
  const name = personName(lead, null);
  return {
    id: `req-fu-${row.id}`,
    personName: name === "Unknown" ? row.title : name,
    personId: lead ? `lead-${lead.id}` : `req-fu-${row.id}`,
    avatarInitials: initialsOf(name === "Unknown" ? row.title : name),
    kind: "follow_up",
    gateName: "Follow-up",
    spaceName: "—",
    periodLabel: row.due_at ? `Due ${formatPeriod(row.due_at, row.due_at)}` : "No date",
    people: 1,
    currency: CURRENCY,
    state:
      row.status === "open"
        ? { label: "Open", tone: "attention" }
        : { label: row.status === "done" ? "Done" : "Cancelled", tone: "neutral" },
    submittedAt: row.created_at,
    notes: row.title,
    checklist: [],
    activity: [],
  };
}

/* ------------------------------------------------------------------ *
 * Spaces & gates
 * ------------------------------------------------------------------ */

export function mapRoomToArea(
  room: RoomRow,
  occupancy: "in_use" | "ready",
  closure: boolean,
): Area {
  const state: Area["state"] = closure ? "attention" : occupancy;
  return {
    id: `area-${room.id}`,
    label: room.name,
    state,
    stateLabel:
      closure ? "Closed" : occupancy === "in_use" ? "In use" : "Ready",
  };
}

export function mapVillaToSpace(
  villa: VillaRow,
  areas: Area[],
  peopleOnSite: number,
  utilizationPct: number,
  nextEvent?: string,
  upkeep: OperationEvent[] = [],
): Space {
  const hasClosure = areas.some((a) => a.state === "attention");
  return {
    id: `space-${villa.id}`,
    name: villa.name,
    spaceType: "residence",
    summary: villa.tagline ?? villa.location,
    utilizationPct,
    state: hasClosure
      ? { label: "Attention", tone: "attention" }
      : peopleOnSite > 0
        ? { label: "Active", tone: "healthy" }
        : { label: "Ready", tone: "neutral" },
    peopleOnSite,
    areas,
    imageUrl: villa.hero_image ?? villa.images?.[0] ?? undefined,
    nextEvent,
    upkeep,
  };
}

export function mapVillaToGate(
  villa: VillaRow,
  spaceIds: string[],
  openRequests: number,
  allocationLabel: string,
): Gate {
  return {
    id: `gate-${villa.id}`,
    name: villa.name,
    summary: villa.tagline ?? villa.location,
    state:
      villa.status === "published"
        ? { label: "Open", tone: "healthy" }
        : villa.status === "coming_soon"
          ? { label: "Coming soon", tone: "attention" }
          : { label: "Archived", tone: "neutral" },
    accessRules: villa.amenities ?? [],
    spaceIds,
    openRequests,
    allocationLabel,
  };
}

/* ------------------------------------------------------------------ *
 * People & vendors
 * ------------------------------------------------------------------ */

const ROLE_TO_RELATIONSHIP: Record<string, PersonRelationship> = {
  member: "member",
  admin: "host",
  operator: "host",
  lead: "applicant",
};

export function relationshipOf(user: UserRow, applications: ApplicationRow[]): PersonRelationship {
  const base = ROLE_TO_RELATIONSHIP[user.role] ?? "member";
  if (base !== "applicant") return base;
  // A lead with an open application is an applicant; otherwise a visitor.
  const open = applications.some((a) => a.status === "submitted" || a.status === "screening");
  return open ? "applicant" : "visitor";
}

export const RELATIONSHIP_LABEL: Record<PersonRelationship, string> = {
  member: "Member",
  visitor: "Visitor",
  applicant: "Applicant",
  host: "Host",
  partner: "Partner",
  vendor: "Partner & crew",
};

export function mapUserToPerson(
  user: UserRow,
  profile: ProfileRow | null,
  lead: LeadRow | null,
  relationship: PersonRelationship,
  upcomingAccess: number,
  confirmedExperiences: number,
  timeline: ActivityEntry[] = [],
): Person {
  const name = profileName(profile, user.email);
  return {
    id: `person-${user.id}`,
    name,
    initials: initialsOf(name),
    relationship,
    relationshipLabel: RELATIONSHIP_LABEL[relationship],
    summary: profile?.headline ?? lead?.source ?? RELATIONSHIP_LABEL[relationship],
    state: { label: RELATIONSHIP_LABEL[relationship], tone: "neutral" },
    avatarUrl: profile?.avatar_url ?? undefined,
    notes: profile?.bio ?? lead?.notes ?? undefined,
    upcomingAccess,
    confirmedExperiences,
    timeline,
  };
}

export function mapStaffToVendor(
  row: StaffApplicationRow,
  jobs: ActivityEntry[] = [],
  activeJobs = 0,
): Vendor {
  const hired = row.status === "hired";
  return {
    id: `vendor-${row.id}`,
    name: row.name,
    category: row.role_applied,
    state: hired
      ? { label: "Active", tone: "healthy" }
      : (STAFF_STATE[row.status] ?? { label: row.status, tone: "neutral" }),
    activeJobs,
    outstandingMinor: 0,
    currency: CURRENCY,
    contactLabel: row.email,
    jobs,
  };
}

/* ------------------------------------------------------------------ *
 * Dues & money
 * ------------------------------------------------------------------ */

export function mapPaymentToTransaction(
  row: PaymentRecordRow,
  booking?: BookingRow | null,
  person?: string | null,
): Transaction {
  const direction: MoneyDirection = row.kind === "refund" ? "outgoing" : "incoming";
  return {
    id: `tx-${row.id}`,
    title:
      row.kind === "deposit"
        ? "Deposit received"
        : row.kind === "balance"
          ? "Balance received"
          : row.kind === "refund"
            ? "Refund issued"
            : "Contribution recorded",
    detail: [person, booking ? formatPeriod(booking.check_in, booking.check_out) : null]
      .filter(Boolean)
      .join(" · ") || (row.note ?? "Payment"),
    amountMinor: toMinor(row.amount),
    currency: row.currency || CURRENCY,
    direction,
    settlement: "confirmed",
    state: { label: "Received", tone: "healthy" },
    at: row.received_at,
    displayPrecision: "none",
    personName: person ?? undefined,
    activity: [],
  };
}

export function mapBookingToOutstanding(
  row: BookingRow,
  paidMinor: number,
  person?: string | null,
): Transaction | null {
  const totalMinor = toMinor(row.total_price);
  const outstanding = totalMinor - paidMinor;
  if (outstanding <= 0) return null;
  return {
    id: `tx-due-${row.id}`,
    title: "Contribution outstanding",
    detail: [person, formatPeriod(row.check_in, row.check_out)].filter(Boolean).join(" · "),
    amountMinor: outstanding,
    currency: row.currency || CURRENCY,
    direction: "incoming",
    settlement: "outstanding",
    state: { label: "Outstanding", tone: "attention" },
    at: row.check_in,
    displayPrecision: "none",
    personName: person ?? undefined,
    activity: [],
  };
}

/* ------------------------------------------------------------------ *
 * Experiences
 * ------------------------------------------------------------------ */

export function mapEventToExperience(
  row: EventRow,
  spaceName: string,
  rsvpConfirmed: number,
): Experience {
  return {
    id: `exp-${row.id}`,
    title: row.title,
    summary: row.description?.slice(0, 140) ?? row.location_note ?? row.event_type,
    startAt: row.start_at,
    // Punctuality is operationally meaningful for experiences (handoff §4).
    displayPrecision: "minute",
    spaceName,
    state: EVENT_STATE[row.status] ?? { label: row.status, tone: "neutral" },
    rsvpConfirmed,
    rsvpCapacity: row.capacity ?? 0,
    budgetSpentMinor: 0,
    budgetTotalMinor: 0,
    currency: CURRENCY,
    notes: row.location_note ?? undefined,
    imageUrl: row.image ?? undefined,
    published: row.status === "published",
  };
}

/* ------------------------------------------------------------------ *
 * Timeline events
 * ------------------------------------------------------------------ */

export function mapBookingToArrivalEvent(row: BookingRow, joins: RequestJoins): OperationEvent {
  const name = personName(joins.lead, joins.user?.email ?? null);
  const done = ["cancelled", "completed"].includes(row.status) || dayOf(row.check_in) < dayOf(new Date().toISOString());
  return {
    id: `ev-arr-${row.id}`,
    sourceType: "bookings",
    sourceId: row.id,
    category: "access",
    kind: "arrival",
    title: done ? "Arrival complete" : "Arrival",
    detail: `${joins.gate?.name ?? "Space"} · ${name} · ${row.guests} ${row.guests === 1 ? "person" : "people"}`,
    sortAt: `${dayOf(row.check_in)}T12:00:00.000Z`,
    displayPrecision: "day",
    status: done ? "complete" : row.status === "requested" ? "confirm" : "ready",
    priority: row.status === "requested" ? "attention" : "normal",
    href: `/requests/req-bk-${row.id}`,
  };
}

export function mapBookingToDepartureEvent(row: BookingRow, joins: RequestJoins): OperationEvent {
  const name = personName(joins.lead, joins.user?.email ?? null);
  const done = ["cancelled", "completed"].includes(row.status);
  return {
    id: `ev-dep-${row.id}`,
    sourceType: "bookings",
    sourceId: row.id,
    category: "access",
    kind: "departure",
    title: done ? "Departure complete" : "Departure",
    detail: `${joins.gate?.name ?? "Space"} · ${name}`,
    sortAt: `${dayOf(row.check_out)}T11:00:00.000Z`,
    displayPrecision: "day",
    status: done ? "complete" : "ready",
    priority: "normal",
    href: `/requests/req-bk-${row.id}`,
  };
}

export function mapApplicationToEvent(row: ApplicationRow): OperationEvent {
  const open = row.status === "submitted" || row.status === "screening";
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email.split("@")[0];
  return {
    id: `ev-app-${row.id}`,
    sourceType: "applications",
    sourceId: row.id,
    category: "requests",
    kind: "application",
    title: open ? "Application needs review" : "Application decided",
    detail: `${name}${row.referred_by ? ` · introduced by ${row.referred_by}` : ""}`,
    sortAt: row.created_at,
    displayPrecision: "none",
    status: open ? "review" : "complete",
    priority: open ? "attention" : "normal",
    href: `/requests/req-app-${row.id}`,
  };
}

export function mapScreeningCallToEvent(row: ScreeningCallRow): OperationEvent {
  const done = row.status === "completed" || row.status === "cancelled" || row.status === "no_show";
  return {
    id: `ev-call-${row.id}`,
    sourceType: "screening_calls",
    sourceId: row.id,
    category: "requests",
    kind: "screening_call",
    title: done ? "Screening call complete" : "Screening call",
    detail: row.prospect_name,
    sortAt: row.scheduled_at,
    displayPrecision: "minute",
    status: done ? "complete" : "ready",
    priority: "normal",
    href: row.application_id
      ? `/requests/req-app-${row.application_id}`
      : "/requests",
  };
}

export function mapFollowUpToEvent(row: FollowUpRow, nowIso: string): OperationEvent {
  const open = row.status === "open";
  const overdue = open && row.due_at != null && row.due_at < nowIso;
  return {
    id: `ev-fu-${row.id}`,
    sourceType: "follow_ups",
    sourceId: row.id,
    category: "requests",
    kind: "follow_up",
    title: row.title,
    sortAt: row.due_at ?? row.created_at,
    displayPrecision: "none",
    status: open ? "in_progress" : "complete",
    priority: overdue ? "attention" : "normal",
    href: "/requests",
    carriedFrom: overdue ? dayOf(row.due_at!) : undefined,
  };
}

export function mapEventToTimelineEvent(row: EventRow, spaceName?: string): OperationEvent {
  const done = row.status === "cancelled";
  return {
    id: `ev-exp-${row.id}`,
    sourceType: "events",
    sourceId: row.id,
    category: "experiences",
    kind: "experience",
    title: row.title,
    detail: spaceName ?? row.location_note ?? undefined,
    sortAt: row.start_at,
    displayPrecision: "minute",
    status: done ? "complete" : row.status === "draft" ? "confirm" : "ready",
    priority: row.status === "draft" ? "attention" : "normal",
    href: `/experiences/exp-${row.id}`,
  };
}

export function mapPaymentToEvent(
  row: PaymentRecordRow,
  person?: string | null,
): OperationEvent {
  const outgoing = row.kind === "refund";
  return {
    id: `ev-tx-${row.id}`,
    sourceType: "payment_records",
    sourceId: row.id,
    category: "dues",
    kind: outgoing ? "refund" : "contribution_received",
    title: outgoing ? "Refund issued" : "Contribution received",
    detail: person ?? undefined,
    sortAt: row.received_at,
    displayPrecision: "none",
    status: "complete",
    priority: "normal",
    amountMinor: toMinor(row.amount),
    currency: row.currency || CURRENCY,
    moneyDirection: outgoing ? "outgoing" : "incoming",
    href: `/dues/tx-${row.id}`,
  };
}

export function mapOutstandingToEvent(tx: Transaction, nowIso: string): OperationEvent {
  const overdue = tx.at < nowIso;
  return {
    id: `ev-due-${tx.id}`,
    sourceType: "bookings",
    sourceId: tx.id.replace("tx-due-", ""),
    category: "dues",
    kind: "contribution_outstanding",
    title: tx.title,
    detail: tx.personName ?? tx.detail,
    sortAt: tx.at,
    displayPrecision: "none",
    status: "blocked",
    priority: overdue ? "critical" : "attention",
    amountMinor: tx.amountMinor,
    currency: tx.currency,
    moneyDirection: "incoming",
    href: `/dues/${tx.id}`,
    carriedFrom: overdue ? dayOf(tx.at) : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Comms / content / knowledge / reports / agents
 * ------------------------------------------------------------------ */

export function mapCampaignToCommunication(row: EmailCampaignRow): Communication {
  return {
    id: `comm-${row.id}`,
    subject: row.name,
    detail: row.subject,
    channel: "broadcast",
    state: CAMPAIGN_STATE[row.status] ?? { label: row.status, tone: "neutral" },
    audience:
      typeof row.audience === "object" && row.audience !== null && "label" in row.audience
        ? String((row.audience as Record<string, unknown>).label)
        : `${row.total_recipients} recipients`,
    at: row.sent_at ?? row.created_at,
  };
}

export function mapContentBlock(row: { id: string; key: string; title: string; updated_at: string }): ContentItem {
  return {
    id: `content-${row.id}`,
    title: row.title,
    detail: row.key,
    state: { label: "Published", tone: "healthy" },
  };
}

export function mapKbNode(row: KbNodeRow): KnowledgeNode {
  return {
    id: `kb-${row.id}`,
    title: row.title,
    detail: row.kind === "folder" ? "Folder" : row.visibility,
    updatedAt: row.updated_at,
    tags: [row.visibility],
  };
}

export function mapReport(
  id: string,
  title: string,
  detail: string,
  metrics: Metric[],
): ReportSummary {
  return { id, title, detail, metrics };
}

export function mapAgentTokenToEntry(row: {
  id: string;
  label: string;
  scope: string;
  revoked_at: string | null;
  last_used_at: string | null;
}): AgentEntry {
  const revoked = Boolean(row.revoked_at);
  return {
    id: `agent-${row.id}`,
    name: row.label,
    detail: revoked
      ? "Revoked"
      : row.last_used_at
        ? `Last active ${dayOf(row.last_used_at)}`
        : "Never used",
    state: revoked
      ? { label: "Revoked", tone: "neutral" }
      : { label: "Active", tone: "healthy" },
    scopes: [row.scope],
  };
}

/* ------------------------------------------------------------------ *
 * Operator account
 * ------------------------------------------------------------------ */

export function mapOperatorAccount(input: {
  id: string;
  email: string;
  role: string;
  profile: ProfileRow | null;
  connections: OperatorAccount["connections"];
}): OperatorAccount {
  const name = profileName(input.profile, input.email);
  return {
    id: input.id,
    name,
    initials: initialsOf(name),
    email: input.email,
    // users.email has no verified flag in the schema; a password-hash or a
    // completed magic round trip is the de-facto verification signal.
    emailVerified: true,
    roleLabel: input.role === "admin" ? "Owner" : "Operator",
    avatarUrl: input.profile?.avatar_url ?? undefined,
    connections: input.connections,
  };
}

/* ------------------------------------------------------------------ *
 * Day summary
 * ------------------------------------------------------------------ */

export function buildDaySummary(input: {
  isoDate: string;
  arrivals: number;
  departures: number;
  requests: number;
  upkeep: number;
  supplies: number;
  dueMinor: number;
  incomingMinor: number;
}): DaySummary {
  return { currency: CURRENCY, ...input };
}
