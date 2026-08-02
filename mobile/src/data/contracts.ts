/**
 * Data contracts for mobile.opencollective.app.
 *
 * PHASE 1 (this file's consumers): every type here is served by the fixture
 * provider in `provider.ts`. No production data is read or mutated.
 *
 * PHASE 2 (Kimi): implement `MobileDataProvider` against permission-checked
 * domain services in `packages/core` and register it in `provider.ts`. Nothing
 * else in the app should need to change — pages and components only ever see
 * this interface. See `mobile/README.md` for the full handoff.
 *
 * Language rule: this is an access network. Gate / Space / Person / access
 * request / access period / arrival / departure / space reset / upkeep /
 * supplies / utilization. Never booking, stay, guest, villa, check-in,
 * checkout, housekeeping or occupancy in presentation copy.
 */

/* ------------------------------------------------------------------ *
 * Timeline — MOBILE_UI_SPEC.md §5
 * ------------------------------------------------------------------ */

export type OperationCategory = "requests" | "access" | "dues" | "experiences";

/** Clock time is rendered only when punctuality is operationally meaningful. */
export type DisplayPrecision = "minute" | "day" | "none";

export type OperationStatus =
  | "complete"
  | "ready"
  | "in_progress"
  | "confirm"
  | "review"
  | "blocked";

export type OperationPriority = "normal" | "attention" | "critical";

export type MoneyDirection = "incoming" | "outgoing";

export type OperationEvent = {
  id: string;
  /** Legacy technical table name; never rendered as UI copy. */
  sourceType: string;
  sourceId: string;
  category: OperationCategory;
  /** Icon/semantic discriminator, e.g. "arrival", "space_reset", "supplies". */
  kind: string;
  title: string;
  detail?: string;
  /** ISO 8601. Controls placement, independent of visible precision. */
  sortAt: string;
  displayPrecision: DisplayPrecision;
  status: OperationStatus;
  priority: OperationPriority;
  amountMinor?: number;
  currency?: string;
  moneyDirection?: MoneyDirection;
  href: string;
  primaryAction?: { label: string; action: string };
  /** Overdue incomplete work carried above the present until resolved. */
  carriedFrom?: string;
};

export type TimelinePage = {
  events: OperationEvent[];
  /** Keyset cursors on (sortAt, id). */
  olderCursor: string | null;
  newerCursor: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
};

export type TimelineQuery = {
  category?: OperationCategory | "all";
  /** Keyset anchor; omitted means "around the present". */
  cursor?: string;
  direction?: "older" | "newer" | "around";
  limit?: number;
};

/* ------------------------------------------------------------------ *
 * Today summary + numbers — MOBILE_UI_SPEC.md §4
 * ------------------------------------------------------------------ */

export type DaySummary = {
  isoDate: string;
  /** Line 1 — flow. */
  arrivals: number;
  departures: number;
  requests: number;
  /** Line 2 — hands. */
  upkeep: number;
  supplies: number;
  /** Line 3 — money, in minor units. */
  dueMinor: number;
  incomingMinor: number;
  currency: string;
};

export type NumbersPeriod = "today" | "7d" | "30d";

export type Metric = {
  key: string;
  label: string;
  /** Preformatted for display; `raw` stays available for charts/tests. */
  value: string;
  raw: number;
  /** Only present when the denominator is valid. */
  deltaLabel?: string;
  deltaDirection?: "up" | "down";
  /** Rendered only when at least five comparable points exist. */
  spark?: number[];
  /** Distinguishes projection from settled or received money. */
  kind: "forecast" | "confirmed" | "outstanding" | "count" | "ratio" | "expense";
};

export type NumbersOfTheDay = {
  period: NumbersPeriod;
  /** Shown in the expanded view so a stale figure is never mistaken for live. */
  asOf: string;
  metrics: Metric[];
};

export type ForecastPoint = {
  isoDate: string;
  settledMinor: number | null;
  projectedMinor: number | null;
};

export type ForecastSeries = {
  currency: string;
  points: ForecastPoint[];
  todayIndex: number;
  forecastMinor: number;
  confirmedMinor: number;
  outstandingMinor: number;
};

/* ------------------------------------------------------------------ *
 * Domain records
 * ------------------------------------------------------------------ */

export type RecordState = {
  label: string;
  tone: "neutral" | "healthy" | "attention" | "critical";
};

export type AccessRequest = {
  id: string;
  personName: string;
  personId: string;
  avatarInitials: string;
  /** "Application" | "Access request" | "Follow-up" — never "booking". */
  kind: "application" | "access_request" | "follow_up";
  gateName: string;
  spaceName: string;
  periodLabel: string;
  people: number;
  expectedContributionMinor?: number;
  currency: string;
  state: RecordState;
  submittedAt: string;
  introducedBy?: string;
  notes?: string;
  checklist: ChecklistItem[];
  activity: ActivityEntry[];
};

export type ChecklistItem = {
  id: string;
  label: string;
  detail?: string;
  state: "done" | "current" | "pending" | "blocked";
  stateLabel: string;
  /** Only when the moment is operationally meaningful. */
  at?: string;
};

export type ActivityEntry = {
  id: string;
  title: string;
  detail?: string;
  at: string;
  displayPrecision: DisplayPrecision;
  tone?: "neutral" | "healthy" | "attention" | "critical";
};

export type AreaState = "ready" | "in_use" | "attention" | "upkeep";

export type Area = {
  id: string;
  /** May read as room, deck, berth or zone — the Space type decides. */
  label: string;
  state: AreaState;
  stateLabel: string;
};

export type Space = {
  id: string;
  name: string;
  /** residence | room | studio | land | venue | boat | berth | … */
  spaceType: string;
  summary: string;
  utilizationPct: number;
  state: RecordState;
  peopleOnSite: number;
  areas: Area[];
  imageUrl?: string;
  nextEvent?: string;
  upkeep: OperationEvent[];
};

export type Gate = {
  id: string;
  name: string;
  summary: string;
  state: RecordState;
  /** Curated access pathway rules. */
  accessRules: string[];
  spaceIds: string[];
  openRequests: number;
  allocationLabel: string;
};

export type PersonRelationship =
  | "member"
  | "visitor"
  | "applicant"
  | "host"
  | "partner"
  | "vendor";

export type Person = {
  id: string;
  name: string;
  initials: string;
  relationship: PersonRelationship;
  relationshipLabel: string;
  summary: string;
  state: RecordState;
  avatarUrl?: string;
  duesLabel?: string;
  duesTone?: RecordState["tone"];
  notes?: string;
  upcomingAccess: number;
  confirmedExperiences: number;
  timeline: ActivityEntry[];
};

export type Vendor = {
  id: string;
  name: string;
  category: string;
  state: RecordState;
  activeJobs: number;
  outstandingMinor: number;
  currency: string;
  contactLabel: string;
  jobs: ActivityEntry[];
};

export type Experience = {
  id: string;
  title: string;
  summary: string;
  startAt: string;
  displayPrecision: DisplayPrecision;
  spaceName: string;
  state: RecordState;
  /** Zero, partial and full capacity are all valid fixtures. */
  rsvpConfirmed: number;
  rsvpCapacity: number;
  budgetSpentMinor: number;
  budgetTotalMinor: number;
  currency: string;
  partner?: string;
  notes?: string;
  imageUrl?: string;
  published: boolean;
};

export type Transaction = {
  id: string;
  title: string;
  detail: string;
  amountMinor: number;
  currency: string;
  direction: MoneyDirection;
  /** confirmed | outstanding | scheduled | forecast */
  settlement: "confirmed" | "outstanding" | "scheduled" | "forecast";
  state: RecordState;
  at: string;
  displayPrecision: DisplayPrecision;
  personName?: string;
  activity: ActivityEntry[];
};

export type Communication = {
  id: string;
  subject: string;
  detail: string;
  channel: "email" | "broadcast" | "direct";
  state: RecordState;
  audience: string;
  at: string;
};

export type ContentItem = {
  id: string;
  title: string;
  detail: string;
  state: RecordState;
};

export type KnowledgeNode = {
  id: string;
  title: string;
  detail: string;
  updatedAt: string;
  tags: string[];
};

export type ReportSummary = {
  id: string;
  title: string;
  detail: string;
  metrics: Metric[];
};

export type AgentEntry = {
  id: string;
  name: string;
  detail: string;
  state: RecordState;
  /** Surfaced so operators can see what an agent may act on. */
  scopes: string[];
};

export type SettingsRow = {
  id: string;
  label: string;
  detail?: string;
  href?: string;
  kind: "navigation" | "toggle" | "select";
  value?: string;
  enabled?: boolean;
  badge?: number;
};

export type SettingsGroup = {
  id: string;
  label: string;
  rows: SettingsRow[];
};

/**
 * The signed-in operator, as shown in the account sheet behind the avatar.
 *
 * PHASE 2: `avatarUrl` should be synced from the member portal's profile
 * image rather than re-uploaded here, and `email` is only changeable through a
 * verification flow that does not exist yet — see PHASE_2_HANDOFF.md.
 */
export type OperatorAccount = {
  id: string;
  name: string;
  initials: string;
  email: string;
  /** Whether the current address has completed verification. */
  emailVerified: boolean;
  roleLabel: string;
  avatarUrl?: string;
  /** Connected system surfaces, shown as status rather than settings. */
  connections: {
    id: string;
    label: string;
    detail: string;
    icon: string;
    href?: string;
    state: RecordState;
  }[];
};

export type MoreGroup = {
  id: string;
  label: string;
  items: {
    id: string;
    label: string;
    href: string;
    icon: string;
    badge?: number;
  }[];
};

/* ------------------------------------------------------------------ *
 * Collecta — MOBILE_UI_SPEC.md §7
 * ------------------------------------------------------------------ */

/**
 * Sent to the assistant. IDs only — Collecta re-fetches records server-side
 * and never trusts client-supplied record content.
 */
export type CollectaContext = {
  route: string;
  filter?: string;
  visibleDate?: string;
  visibleEventIds: string[];
  selectedEventId?: string;
};

export type CollectaState =
  | "closed"
  | "open"
  | "thinking"
  | "answer"
  | "draft"
  | "confirmation";

export type CollectaMessage = {
  id: string;
  role: "operator" | "collecta";
  body: string;
  at: string;
};

export type CollectaDraft = {
  id: string;
  title: string;
  detail: string;
  /** Material changes always run draft → review → confirm → audit. */
  facts: { label: string; value: string }[];
  confirmLabel: string;
  /** Money, access, approval and publishing always require confirmation. */
  requiresConfirmation: true;
};

export type CollectaTurn = {
  state: CollectaState;
  messages: CollectaMessage[];
  draft?: CollectaDraft;
};

/* ------------------------------------------------------------------ *
 * Composer — MOBILE_UI_SPEC.md §7 "Add"
 * ------------------------------------------------------------------ */

export type ComposerKind =
  | "request"
  | "access"
  | "space_reset"
  | "due"
  | "experience"
  | "note";

export type ComposerOption = {
  kind: ComposerKind;
  label: string;
  detail: string;
  icon: string;
};

/**
 * Anything a new item can be attached to. Nothing is created free-floating:
 * an access period belongs to a Space, a due belongs to a Person or partner,
 * an experience belongs to a Space, and so on.
 */
export type LinkTargetKind = "space" | "person" | "vendor" | "experience" | "gate";

export type LinkTarget = {
  id: string;
  kind: LinkTargetKind;
  label: string;
  detail?: string;
  /** Where the record itself lives, so the composer can deep-link to it. */
  href: string;
};

export const LINK_TARGET_LABELS: Record<LinkTargetKind, string> = {
  space: "Spaces",
  person: "People",
  vendor: "Partners & crew",
  experience: "Experiences",
  gate: "Gates",
};

/** Which kinds a composer type offers first. Search still spans everything. */
export const LINK_KINDS_BY_COMPOSER: Record<ComposerKind, LinkTargetKind[]> = {
  request: ["gate", "person", "space"],
  access: ["space", "person", "gate"],
  space_reset: ["space", "vendor"],
  due: ["person", "vendor"],
  experience: ["space", "vendor", "person"],
  note: ["person", "space", "vendor", "experience", "gate"],
};

/* ------------------------------------------------------------------ *
 * Load states — every screen renders all five
 * ------------------------------------------------------------------ */

export type Scenario = "healthy" | "empty" | "loading" | "error" | "offline" | "busy";

export type Result<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "offline" };

/* ------------------------------------------------------------------ *
 * The provider interface Kimi replaces in Phase 2
 * ------------------------------------------------------------------ */

export interface MobileDataProvider {
  /** Fixture provider ignores this; the Phase 2 provider must scope by session. */
  readonly name: string;

  getDaySummary(): Promise<Result<DaySummary>>;
  getNumbers(period: NumbersPeriod): Promise<Result<NumbersOfTheDay>>;
  getForecast(period: NumbersPeriod): Promise<Result<ForecastSeries>>;

  getTimeline(query: TimelineQuery): Promise<Result<TimelinePage>>;

  listRequests(filter?: string): Promise<Result<AccessRequest[]>>;
  getRequest(id: string): Promise<Result<AccessRequest>>;

  listSpaces(): Promise<Result<Space[]>>;
  getSpace(id: string): Promise<Result<Space>>;

  listGates(): Promise<Result<Gate[]>>;
  getGate(id: string): Promise<Result<Gate>>;

  listTransactions(filter?: string): Promise<Result<Transaction[]>>;
  getTransaction(id: string): Promise<Result<Transaction>>;

  listExperiences(): Promise<Result<Experience[]>>;
  getExperience(id: string): Promise<Result<Experience>>;

  listPeople(relationship?: string): Promise<Result<Person[]>>;
  getPerson(id: string): Promise<Result<Person>>;

  listVendors(): Promise<Result<Vendor[]>>;
  getVendor(id: string): Promise<Result<Vendor>>;

  listCommunications(): Promise<Result<Communication[]>>;
  listContent(): Promise<Result<ContentItem[]>>;
  listKnowledge(): Promise<Result<KnowledgeNode[]>>;
  listReports(): Promise<Result<ReportSummary[]>>;
  listAgents(): Promise<Result<AgentEntry[]>>;

  /** The signed-in operator. Phase 2 must read this from the session. */
  getOperator(): Promise<Result<OperatorAccount>>;

  getSettings(): Promise<Result<SettingsGroup[]>>;
  getMoreGroups(): Promise<Result<MoreGroup[]>>;

  getComposerOptions(): ComposerOption[];

  /**
   * Records a new item can be linked to, filtered by a free-text query.
   * Phase 2 must scope this to what the session is permitted to see.
   */
  searchLinkTargets(query: string, kinds?: LinkTargetKind[]): Promise<Result<LinkTarget[]>>;

  /**
   * Phase 1 returns a scripted turn. Phase 2 must re-fetch every referenced
   * record server-side and return drafts, never applied changes.
   */
  askCollecta(context: CollectaContext, prompt: string): Promise<CollectaTurn>;
}
