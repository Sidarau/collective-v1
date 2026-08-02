/**
 * Typed Phase 1 fixtures.
 *
 * Nothing here is production data. Names are invented, and there are no real
 * contact details, addresses or private notes. Consumers must go through
 * `provider.ts` — pages and components never import this module directly.
 *
 * Time is anchored to a fixed instant so Playwright screenshots and timeline
 * ordering tests are deterministic.
 */

import type {
  AccessRequest,
  AgentEntry,
  Communication,
  ComposerOption,
  ContentItem,
  DaySummary,
  Experience,
  ForecastSeries,
  Gate,
  KnowledgeNode,
  MoreGroup,
  NumbersOfTheDay,
  NumbersPeriod,
  OperationEvent,
  OperatorAccount,
  Person,
  ReportSummary,
  SettingsGroup,
  Space,
  Transaction,
  Vendor,
} from "./contracts";

/** Sunday, 26 July 2026, 14:20 in the Collective's operating timezone. */
export const FIXTURE_NOW = "2026-07-26T12:20:00.000Z";
export const FIXTURE_TODAY = "2026-07-26";
export const CURRENCY = "EUR";

const at = (iso: string) => new Date(iso).toISOString();

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

export const TIMELINE_EVENTS: OperationEvent[] = [
  /* ---- history: 24 July ---- */
  {
    id: "ev-h-001",
    sourceType: "access_periods",
    sourceId: "ap-880",
    category: "access",
    kind: "departure",
    title: "Departure complete",
    detail: "Can Verde · 3 people",
    sortAt: at("2026-07-24T09:00:00Z"),
    displayPrecision: "minute",
    status: "complete",
    priority: "normal",
    href: "/spaces/space-can-verde",
  },
  {
    id: "ev-h-002",
    sourceType: "transactions",
    sourceId: "tx-410",
    category: "dues",
    kind: "contribution_received",
    title: "€1,200 contribution received",
    detail: "Ana Martins",
    sortAt: at("2026-07-24T15:40:00Z"),
    displayPrecision: "none",
    status: "complete",
    priority: "normal",
    amountMinor: 120000,
    currency: CURRENCY,
    moneyDirection: "incoming",
    href: "/dues/tx-410",
  },
  /* ---- history: 25 July ---- */
  {
    id: "ev-h-003",
    sourceType: "applications",
    sourceId: "req-302",
    category: "requests",
    kind: "screening_call",
    title: "Screening call complete",
    detail: "Maya Laurent · introduced by Ana",
    sortAt: at("2026-07-25T09:30:00Z"),
    displayPrecision: "minute",
    status: "complete",
    priority: "normal",
    href: "/requests/req-302",
  },
  {
    id: "ev-h-004",
    sourceType: "upkeep_tasks",
    sourceId: "up-77",
    category: "access",
    kind: "space_reset",
    title: "Space reset complete",
    detail: "Can Verde · Areas 1–3",
    sortAt: at("2026-07-25T13:10:00Z"),
    displayPrecision: "none",
    status: "complete",
    priority: "normal",
    href: "/spaces/space-can-verde",
  },
  /* ---- 26 July: overdue work carried forward above the present ---- */
  {
    id: "ev-c-001",
    sourceType: "supply_orders",
    sourceId: "sup-19",
    category: "access",
    kind: "supplies",
    title: "Supplies list still unconfirmed",
    detail: "Kitchen · Sol Provisions",
    sortAt: at("2026-07-25T16:00:00Z"),
    displayPrecision: "none",
    status: "confirm",
    priority: "attention",
    href: "/spaces/space-roca-llisa",
    primaryAction: { label: "Confirm list", action: "supplies.confirm" },
    carriedFrom: "2026-07-25",
  },
  {
    id: "ev-c-002",
    sourceType: "transactions",
    sourceId: "tx-455",
    category: "dues",
    kind: "vendor_invoice",
    title: "Vendor invoice overdue",
    detail: "Sol Provisions · 6 days",
    sortAt: at("2026-07-20T10:00:00Z"),
    displayPrecision: "none",
    status: "blocked",
    priority: "critical",
    amountMinor: 148000,
    currency: CURRENCY,
    moneyDirection: "outgoing",
    href: "/dues/tx-455",
    primaryAction: { label: "Review", action: "transaction.review" },
    carriedFrom: "2026-07-20",
  },
  /* ---- 26 July: present and forward ---- */
  {
    id: "ev-001",
    sourceType: "access_requests",
    sourceId: "req-301",
    category: "requests",
    kind: "access_request",
    title: "Access request",
    detail: "Nora + 1 · 29 Jul–2 Aug",
    sortAt: at("2026-07-26T12:25:00Z"),
    displayPrecision: "none",
    status: "review",
    priority: "critical",
    href: "/requests/req-301",
    primaryAction: { label: "Review", action: "request.review" },
  },
  {
    id: "ev-002",
    sourceType: "upkeep_tasks",
    sourceId: "up-91",
    category: "access",
    kind: "space_reset",
    title: "Space reset",
    detail: "Roca Llisa · Carmen + team",
    sortAt: at("2026-07-26T12:40:00Z"),
    displayPrecision: "none",
    status: "in_progress",
    priority: "normal",
    href: "/spaces/space-roca-llisa",
  },
  {
    id: "ev-003",
    sourceType: "upkeep_tasks",
    sourceId: "up-92",
    category: "access",
    kind: "upkeep",
    title: "Pool system upkeep",
    detail: "Can Verde · Partner confirmed",
    sortAt: at("2026-07-26T13:30:00Z"),
    displayPrecision: "none",
    status: "ready",
    priority: "normal",
    href: "/spaces/space-can-verde",
  },
  {
    id: "ev-004",
    sourceType: "access_periods",
    sourceId: "ap-901",
    category: "access",
    kind: "arrival",
    title: "Arrival",
    detail: "Ana + 2 · Roca Llisa",
    sortAt: at("2026-07-26T15:30:00Z"),
    displayPrecision: "minute",
    status: "ready",
    priority: "normal",
    href: "/people/person-ana-martins",
    primaryAction: { label: "Begin access handoff", action: "access.handoff" },
  },
  {
    id: "ev-005",
    sourceType: "supply_orders",
    sourceId: "sup-20",
    category: "access",
    kind: "supplies",
    title: "Supplies delivery",
    detail: "Kitchen · Sol Provisions",
    sortAt: at("2026-07-26T16:00:00Z"),
    displayPrecision: "none",
    status: "confirm",
    priority: "attention",
    href: "/vendors/vendor-sol-provisions",
    primaryAction: { label: "Confirm list", action: "supplies.confirm" },
  },
  {
    id: "ev-006",
    sourceType: "transactions",
    sourceId: "tx-460",
    category: "dues",
    kind: "contribution_due",
    title: "€850 contribution due",
    detail: "Community partner",
    sortAt: at("2026-07-26T16:30:00Z"),
    displayPrecision: "none",
    status: "ready",
    priority: "normal",
    amountMinor: 85000,
    currency: CURRENCY,
    moneyDirection: "incoming",
    href: "/dues/tx-460",
  },
  {
    id: "ev-007",
    sourceType: "events",
    sourceId: "exp-501",
    category: "experiences",
    kind: "experience",
    title: "Founders’ dinner",
    detail: "12 people · Terrace",
    sortAt: at("2026-07-26T17:30:00Z"),
    displayPrecision: "minute",
    status: "ready",
    priority: "normal",
    href: "/experiences/exp-501",
  },
  /* ---- 27 July ---- */
  {
    id: "ev-008",
    sourceType: "events",
    sourceId: "exp-502",
    category: "experiences",
    kind: "experience",
    title: "Morning breathwork",
    detail: "8 of 12 RSVP · Garden deck",
    sortAt: at("2026-07-27T06:30:00Z"),
    displayPrecision: "minute",
    status: "ready",
    priority: "normal",
    href: "/experiences/exp-502",
  },
  {
    id: "ev-009",
    sourceType: "upkeep_tasks",
    sourceId: "up-93",
    category: "access",
    kind: "upkeep",
    title: "AC repair",
    detail: "Roca Llisa · Awaiting parts",
    sortAt: at("2026-07-27T09:00:00Z"),
    displayPrecision: "none",
    status: "blocked",
    priority: "critical",
    href: "/spaces/space-roca-llisa",
  },
  {
    id: "ev-010",
    sourceType: "applications",
    sourceId: "req-302",
    category: "requests",
    kind: "application",
    title: "Application decision due",
    detail: "Maya Laurent · screening ready",
    sortAt: at("2026-07-27T11:00:00Z"),
    displayPrecision: "none",
    status: "review",
    priority: "attention",
    href: "/requests/req-302",
    primaryAction: { label: "Review", action: "request.review" },
  },
  /* ---- 28–30 July ---- */
  {
    id: "ev-011",
    sourceType: "transactions",
    sourceId: "tx-470",
    category: "dues",
    kind: "stewardship_due",
    title: "Monthly stewardship due",
    detail: "Community partner",
    sortAt: at("2026-07-28T08:00:00Z"),
    displayPrecision: "none",
    status: "ready",
    priority: "normal",
    amountMinor: 240000,
    currency: CURRENCY,
    moneyDirection: "incoming",
    href: "/dues/tx-470",
  },
  {
    id: "ev-012",
    sourceType: "access_periods",
    sourceId: "ap-902",
    category: "access",
    kind: "arrival",
    title: "Arrival",
    detail: "Nora + 1 · pending approval",
    sortAt: at("2026-07-29T14:00:00Z"),
    displayPrecision: "minute",
    status: "confirm",
    priority: "attention",
    href: "/requests/req-301",
  },
  {
    id: "ev-013",
    sourceType: "transactions",
    sourceId: "tx-471",
    category: "dues",
    kind: "partner_payment",
    title: "Upkeep partner payment",
    detail: "Scheduled transfer",
    sortAt: at("2026-07-30T08:00:00Z"),
    displayPrecision: "none",
    status: "ready",
    priority: "normal",
    amountMinor: 62000,
    currency: CURRENCY,
    moneyDirection: "outgoing",
    href: "/dues/tx-471",
  },
  /* ---- August ---- */
  {
    id: "ev-014",
    sourceType: "events",
    sourceId: "exp-503",
    category: "experiences",
    kind: "experience",
    title: "Civic Tech Summit",
    detail: "Draft · Convention hall",
    sortAt: at("2026-08-03T08:00:00Z"),
    displayPrecision: "day",
    status: "confirm",
    priority: "attention",
    href: "/experiences/exp-503",
    primaryAction: { label: "Publish", action: "experience.publish" },
  },
  {
    id: "ev-015",
    sourceType: "access_periods",
    sourceId: "ap-903",
    category: "access",
    kind: "departure",
    title: "Departure",
    detail: "Ana + 2 · Roca Llisa",
    sortAt: at("2026-08-02T09:00:00Z"),
    displayPrecision: "minute",
    status: "ready",
    priority: "normal",
    href: "/people/person-ana-martins",
  },
];

/** High-activity variant: same shape, dense day. */
export const BUSY_TIMELINE_EVENTS: OperationEvent[] = [
  ...TIMELINE_EVENTS,
  ...Array.from({ length: 14 }, (_, i): OperationEvent => {
    const hour = 6 + i;
    const categories = ["access", "requests", "dues", "experiences"] as const;
    const category = categories[i % 4];
    return {
      id: `ev-busy-${i}`,
      sourceType: "upkeep_tasks",
      sourceId: `busy-${i}`,
      category,
      kind: category === "dues" ? "contribution_due" : "upkeep",
      title:
        i % 5 === 0
          ? "Berth inspection and anti-fouling assessment for the north pontoon"
          : `Zone ${i + 1} readiness check`,
      detail: "Marina zone · Partner crew",
      sortAt: at(`2026-07-26T${String(hour).padStart(2, "0")}:15:00Z`),
      displayPrecision: category === "experiences" ? "minute" : "none",
      status: i % 3 === 0 ? "ready" : i % 3 === 1 ? "in_progress" : "confirm",
      priority: i % 7 === 0 ? "attention" : "normal",
      href: "/spaces/space-marina",
      ...(category === "dues"
        ? {
            amountMinor: 4500 * (i + 1),
            currency: CURRENCY,
            moneyDirection: "incoming" as const,
          }
        : {}),
    };
  }),
];

/* ------------------------------------------------------------------ *
 * Today summary + numbers
 * ------------------------------------------------------------------ */

export const DAY_SUMMARY: DaySummary = {
  isoDate: FIXTURE_TODAY,
  arrivals: 2,
  departures: 1,
  requests: 3,
  upkeep: 2,
  supplies: 1,
  dueMinor: 240000,
  incomingMinor: 85000,
  currency: CURRENCY,
};

export const EMPTY_DAY_SUMMARY: DaySummary = {
  isoDate: FIXTURE_TODAY,
  arrivals: 0,
  departures: 0,
  requests: 0,
  upkeep: 0,
  supplies: 0,
  dueMinor: 0,
  incomingMinor: 0,
  currency: CURRENCY,
};

const NUMBERS: Record<NumbersPeriod, NumbersOfTheDay> = {
  today: {
    period: "today",
    asOf: FIXTURE_NOW,
    metrics: [
      {
        key: "revenue_forecast",
        label: "Revenue forecast",
        value: "€12,840",
        raw: 1284000,
        kind: "forecast",
        deltaLabel: "+€640",
        deltaDirection: "up",
        spark: [7, 8, 9, 8, 11, 12, 13],
      },
      {
        key: "confirmed_revenue",
        label: "Confirmed",
        value: "€4,120",
        raw: 412000,
        kind: "confirmed",
      },
      {
        key: "outstanding_revenue",
        label: "Outstanding",
        value: "€2,400",
        raw: 240000,
        kind: "outstanding",
      },
      {
        key: "access_periods",
        label: "Access periods",
        value: "6",
        raw: 6,
        kind: "count",
        deltaLabel: "+1",
        deltaDirection: "up",
      },
      {
        key: "new_members",
        label: "New members",
        value: "1",
        raw: 1,
        kind: "count",
      },
      {
        key: "utilization",
        label: "Space utilization",
        value: "78%",
        raw: 78,
        kind: "ratio",
        deltaLabel: "+5%",
        deltaDirection: "up",
      },
      {
        key: "avg_access_value",
        label: "Average access value",
        value: "€1,420",
        raw: 142000,
        kind: "confirmed",
      },
      {
        key: "expenses",
        label: "Operating expenses",
        value: "€980",
        raw: 98000,
        kind: "expense",
      },
    ],
  },
  "7d": {
    period: "7d",
    asOf: FIXTURE_NOW,
    metrics: [
      {
        key: "revenue_forecast",
        label: "Revenue forecast",
        value: "€38,400",
        raw: 3840000,
        kind: "forecast",
        deltaLabel: "+€2,150",
        deltaDirection: "up",
        spark: [22, 26, 25, 30, 33, 35, 38],
      },
      {
        key: "confirmed_revenue",
        label: "Confirmed",
        value: "€21,300",
        raw: 2130000,
        kind: "confirmed",
        deltaLabel: "+8%",
        deltaDirection: "up",
      },
      {
        key: "outstanding_revenue",
        label: "Outstanding",
        value: "€6,120",
        raw: 612000,
        kind: "outstanding",
      },
      {
        key: "access_periods",
        label: "Access periods",
        value: "18",
        raw: 18,
        kind: "count",
        deltaLabel: "+4",
        deltaDirection: "up",
        spark: [10, 12, 11, 14, 15, 17, 18],
      },
      {
        key: "new_members",
        label: "New members",
        value: "5",
        raw: 5,
        kind: "count",
        deltaLabel: "+2",
        deltaDirection: "up",
      },
      {
        key: "utilization",
        label: "Space utilization",
        value: "74%",
        raw: 74,
        kind: "ratio",
        deltaLabel: "+3%",
        deltaDirection: "up",
      },
      {
        key: "avg_access_value",
        label: "Average access value",
        value: "€1,380",
        raw: 138000,
        kind: "confirmed",
      },
      {
        key: "expenses",
        label: "Operating expenses",
        value: "€4,240",
        raw: 424000,
        kind: "expense",
        deltaLabel: "−2%",
        deltaDirection: "down",
      },
    ],
  },
  "30d": {
    period: "30d",
    asOf: FIXTURE_NOW,
    metrics: [
      {
        key: "revenue_forecast",
        label: "Revenue forecast",
        value: "€128,420",
        raw: 12842000,
        kind: "forecast",
        deltaLabel: "+€5,640",
        deltaDirection: "up",
        spark: [82, 88, 95, 101, 108, 118, 128],
      },
      {
        key: "confirmed_revenue",
        label: "Confirmed",
        value: "€34,800",
        raw: 3480000,
        kind: "confirmed",
        deltaLabel: "+12%",
        deltaDirection: "up",
      },
      {
        key: "outstanding_revenue",
        label: "Outstanding",
        value: "€8,250",
        raw: 825000,
        kind: "outstanding",
      },
      {
        key: "access_periods",
        label: "Access periods",
        value: "24",
        raw: 24,
        kind: "count",
        deltaLabel: "+6",
        deltaDirection: "up",
        spark: [12, 15, 17, 18, 20, 22, 24],
      },
      {
        key: "new_members",
        label: "New members",
        value: "12",
        raw: 12,
        kind: "count",
        deltaLabel: "+2",
        deltaDirection: "up",
        spark: [4, 5, 7, 8, 9, 11, 12],
      },
      {
        key: "utilization",
        label: "Space utilization",
        value: "78%",
        raw: 78,
        kind: "ratio",
        deltaLabel: "+5%",
        deltaDirection: "up",
      },
      {
        key: "avg_access_value",
        label: "Average access value",
        value: "€1,420",
        raw: 142000,
        kind: "confirmed",
      },
      {
        key: "expenses",
        label: "Operating expenses",
        value: "€12,400",
        raw: 1240000,
        kind: "expense",
        deltaLabel: "+4%",
        deltaDirection: "up",
      },
    ],
  },
};

export const numbersFor = (period: NumbersPeriod) => NUMBERS[period];

/** Today has too few comparable points for a sparkline on most metrics. */
export const SPARSE_NUMBERS: NumbersOfTheDay = {
  period: "today",
  asOf: FIXTURE_NOW,
  metrics: NUMBERS.today.metrics.map((m) => ({ ...m, spark: undefined, deltaLabel: undefined })),
};

const buildForecast = (days: number, scale: number): ForecastSeries => {
  const points = Array.from({ length: days }, (_, i) => {
    const d = new Date("2026-07-11T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const isoDate = d.toISOString().slice(0, 10);
    const past = isoDate <= FIXTURE_TODAY;
    const base = Math.round((18000 + i * 2400 + Math.sin(i / 2) * 3200) * scale);
    return {
      isoDate,
      settledMinor: past ? base : null,
      projectedMinor: past ? (isoDate === FIXTURE_TODAY ? base : null) : base + 2600 * (i % 4),
    };
  });
  return {
    currency: CURRENCY,
    points,
    todayIndex: points.findIndex((p) => p.isoDate === FIXTURE_TODAY),
    forecastMinor: 12842000,
    confirmedMinor: 3480000,
    outstandingMinor: 825000,
  };
};

export const FORECAST: Record<NumbersPeriod, ForecastSeries> = {
  today: buildForecast(16, 0.08),
  "7d": buildForecast(22, 0.3),
  "30d": buildForecast(38, 1),
};

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

export const REQUESTS: AccessRequest[] = [
  {
    id: "req-301",
    personName: "Nora Lind",
    personId: "person-nora-lind",
    avatarInitials: "NL",
    kind: "access_request",
    gateName: "North Gate",
    spaceName: "Roca Llisa",
    periodLabel: "29 Jul – 2 Aug (4 nights)",
    people: 2,
    expectedContributionMinor: 140000,
    currency: CURRENCY,
    state: { label: "Review", tone: "critical" },
    submittedAt: at("2026-07-24T09:12:00Z"),
    notes: "Requested ground-floor access.",
    checklist: [
      { id: "c1", label: "Identity verified", detail: "Nora + 1", state: "done", stateLabel: "Verified" },
      { id: "c2", label: "Space ready", detail: "Roca Llisa · Area 2", state: "done", stateLabel: "Ready" },
      {
        id: "c3",
        label: "Arrival transport confirmed",
        state: "done",
        stateLabel: "Confirmed",
        at: at("2026-07-29T15:00:00Z"),
      },
      {
        id: "c4",
        label: "Arrival",
        detail: "North Gate",
        state: "current",
        stateLabel: "Upcoming",
        at: at("2026-07-29T15:30:00Z"),
      },
      { id: "c5", label: "Welcome note", state: "pending", stateLabel: "Pending" },
    ],
    activity: [
      {
        id: "a1",
        title: "Access request submitted",
        detail: "Through North Gate",
        at: at("2026-07-24T09:12:00Z"),
        displayPrecision: "none",
      },
      {
        id: "a2",
        title: "Identity verified",
        at: at("2026-07-25T10:00:00Z"),
        displayPrecision: "none",
        tone: "healthy",
      },
    ],
  },
  {
    id: "req-302",
    personName: "Maya Laurent",
    personId: "person-maya-laurent",
    avatarInitials: "ML",
    kind: "application",
    gateName: "Founding circle",
    spaceName: "—",
    periodLabel: "Open application",
    people: 1,
    currency: CURRENCY,
    state: { label: "Screening ready", tone: "attention" },
    submittedAt: at("2026-07-18T14:00:00Z"),
    introducedBy: "Ana Martins",
    checklist: [
      { id: "c1", label: "Introduction received", state: "done", stateLabel: "Done" },
      { id: "c2", label: "Screening call", state: "done", stateLabel: "Complete" },
      { id: "c3", label: "Circle decision", state: "current", stateLabel: "Needs decision" },
    ],
    activity: [
      {
        id: "a1",
        title: "Screening call complete",
        at: at("2026-07-25T09:30:00Z"),
        displayPrecision: "minute",
        tone: "healthy",
      },
    ],
  },
  {
    id: "req-303",
    personName: "Ana Martins",
    personId: "person-ana-martins",
    avatarInitials: "AM",
    kind: "follow_up",
    gateName: "North Gate",
    spaceName: "Roca Llisa",
    periodLabel: "Today",
    people: 3,
    currency: CURRENCY,
    state: { label: "Due today", tone: "critical" },
    submittedAt: at("2026-07-26T07:00:00Z"),
    checklist: [
      { id: "c1", label: "Access details sent", state: "done", stateLabel: "Sent" },
      { id: "c2", label: "Arrival handoff", state: "current", stateLabel: "Today" },
    ],
    activity: [],
  },
  {
    id: "req-304",
    personName: "Bartholomew Okonkwo-Fitzgerald",
    personId: "person-bartholomew",
    avatarInitials: "BO",
    kind: "access_request",
    gateName: "Marina programme",
    spaceName: "Berth 12 · North pontoon",
    periodLabel: "12 – 19 Aug (7 nights)",
    people: 4,
    expectedContributionMinor: 320000,
    currency: CURRENCY,
    state: { label: "Awaiting availability", tone: "neutral" },
    submittedAt: at("2026-07-26T06:00:00Z"),
    checklist: [{ id: "c1", label: "Berth availability", state: "blocked", stateLabel: "Blocked" }],
    activity: [],
  },
];

/* ------------------------------------------------------------------ *
 * Spaces, Gates
 * ------------------------------------------------------------------ */

export const SPACES: Space[] = [
  {
    id: "space-roca-llisa",
    name: "Roca Llisa",
    spaceType: "Coastal residence",
    summary: "Coastal residence · 4 areas",
    utilizationPct: 78,
    state: { label: "In use", tone: "healthy" },
    peopleOnSite: 3,
    nextEvent: "Arrival 17:30",
    areas: [
      { id: "ar-1", label: "Area 1", state: "ready", stateLabel: "Ready" },
      { id: "ar-2", label: "Area 2", state: "in_use", stateLabel: "In use" },
      { id: "ar-3", label: "Area 3", state: "in_use", stateLabel: "In use" },
      { id: "ar-4", label: "Area 4", state: "attention", stateLabel: "Attention" },
    ],
    upkeep: TIMELINE_EVENTS.filter((e) => e.href === "/spaces/space-roca-llisa"),
  },
  {
    id: "space-can-verde",
    name: "Can Verde",
    spaceType: "Inland residence",
    summary: "Inland residence · 3 areas",
    utilizationPct: 54,
    state: { label: "Ready", tone: "healthy" },
    peopleOnSite: 0,
    nextEvent: "Pool system upkeep",
    areas: [
      { id: "ar-1", label: "Area 1", state: "ready", stateLabel: "Ready" },
      { id: "ar-2", label: "Area 2", state: "ready", stateLabel: "Ready" },
      { id: "ar-3", label: "Pool", state: "upkeep", stateLabel: "Upkeep" },
    ],
    upkeep: TIMELINE_EVENTS.filter((e) => e.href === "/spaces/space-can-verde"),
  },
  {
    id: "space-marina",
    name: "North pontoon",
    spaceType: "Berths",
    summary: "Marina · 6 berths",
    utilizationPct: 41,
    state: { label: "Attention", tone: "attention" },
    peopleOnSite: 1,
    nextEvent: "Berth inspection",
    areas: [
      { id: "b-10", label: "Berth 10", state: "in_use", stateLabel: "In use" },
      { id: "b-11", label: "Berth 11", state: "ready", stateLabel: "Ready" },
      { id: "b-12", label: "Berth 12", state: "attention", stateLabel: "Blocked" },
      { id: "b-13", label: "Deck store", state: "upkeep", stateLabel: "Upkeep" },
    ],
    upkeep: [],
  },
  {
    id: "space-studio",
    name: "Terrace studio",
    spaceType: "Studio",
    summary: "Studio · 1 zone",
    utilizationPct: 92,
    state: { label: "In use", tone: "healthy" },
    peopleOnSite: 2,
    nextEvent: "Founders’ dinner 19:30",
    areas: [{ id: "z-1", label: "Main zone", state: "in_use", stateLabel: "In use" }],
    upkeep: [],
  },
  {
    id: "space-land",
    name: "Es Codolar land parcel",
    spaceType: "Land",
    summary: "Land · 2 zones · seasonal",
    utilizationPct: 0,
    state: { label: "Closed", tone: "neutral" },
    peopleOnSite: 0,
    areas: [
      { id: "z-1", label: "North zone", state: "ready", stateLabel: "Ready" },
      { id: "z-2", label: "South zone", state: "upkeep", stateLabel: "Upkeep" },
    ],
    upkeep: [],
  },
];

export const GATES: Gate[] = [
  {
    id: "gate-north",
    name: "North Gate",
    summary: "Main entrance pathway",
    state: { label: "Online", tone: "healthy" },
    accessRules: [
      "Member or approved visitor",
      "Access period confirmed in advance",
      "Arrival window 08:00 – 22:00",
    ],
    spaceIds: ["space-roca-llisa", "space-can-verde"],
    openRequests: 2,
    allocationLabel: "6 of 8 access periods allocated",
  },
  {
    id: "gate-founding",
    name: "Founding circle",
    summary: "Invitation-only membership pathway",
    state: { label: "Reviewing", tone: "attention" },
    accessRules: ["Introduction required", "Screening call", "Circle decision"],
    spaceIds: [],
    openRequests: 1,
    allocationLabel: "3 places remaining this season",
  },
  {
    id: "gate-marina",
    name: "Marina programme",
    summary: "Berth and vessel access",
    state: { label: "Limited", tone: "attention" },
    accessRules: ["Vessel details on file", "Berth availability confirmed"],
    spaceIds: ["space-marina"],
    openRequests: 1,
    allocationLabel: "4 of 6 berths allocated",
  },
];

/* ------------------------------------------------------------------ *
 * People, vendors
 * ------------------------------------------------------------------ */

export const PEOPLE: Person[] = [
  {
    id: "person-ana-martins",
    name: "Ana Martins",
    initials: "AM",
    relationship: "member",
    relationshipLabel: "Member",
    summary: "Member · Roca Llisa",
    state: { label: "Arriving today", tone: "healthy" },
    duesLabel: "€850 due",
    duesTone: "attention",
    notes: "Prefers ground floor access",
    upcomingAccess: 2,
    confirmedExperiences: 1,
    timeline: [
      {
        id: "t1",
        title: "Contribution due",
        detail: "€850 · Due today",
        at: FIXTURE_NOW,
        displayPrecision: "none",
        tone: "attention",
      },
      {
        id: "t2",
        title: "Access approved",
        detail: "At Roca Llisa",
        at: at("2026-07-25T10:00:00Z"),
        displayPrecision: "none",
        tone: "healthy",
      },
      {
        id: "t3",
        title: "Space preference note",
        detail: "Ground floor access preferred",
        at: at("2026-07-24T10:00:00Z"),
        displayPrecision: "none",
      },
    ],
  },
  {
    id: "person-jonas-eriksen",
    name: "Jonas Eriksen",
    initials: "JE",
    relationship: "visitor",
    relationshipLabel: "Visitor",
    summary: "Visitor · Can Verde",
    state: { label: "Departing in 2 days", tone: "neutral" },
    upcomingAccess: 1,
    confirmedExperiences: 0,
    timeline: [],
  },
  {
    id: "person-nora-lind",
    name: "Nora Lind",
    initials: "NL",
    relationship: "applicant",
    relationshipLabel: "Applicant",
    summary: "Applicant · North Gate",
    state: { label: "Access requested", tone: "attention" },
    upcomingAccess: 1,
    confirmedExperiences: 0,
    timeline: [
      {
        id: "t1",
        title: "Access request submitted",
        at: at("2026-07-24T09:12:00Z"),
        displayPrecision: "none",
      },
    ],
  },
  {
    id: "person-maya-laurent",
    name: "Maya Laurent",
    initials: "ML",
    relationship: "applicant",
    relationshipLabel: "Applicant",
    summary: "Application · introduced by Ana",
    state: { label: "Screening ready", tone: "attention" },
    upcomingAccess: 0,
    confirmedExperiences: 0,
    timeline: [],
  },
  {
    id: "person-bartholomew",
    name: "Bartholomew Okonkwo-Fitzgerald",
    initials: "BO",
    relationship: "applicant",
    relationshipLabel: "Applicant",
    summary: "Marina programme · Berth 12 · North pontoon",
    state: { label: "Awaiting availability", tone: "neutral" },
    upcomingAccess: 0,
    confirmedExperiences: 0,
    timeline: [],
  },
  {
    id: "person-carmen",
    name: "Carmen Ferrer",
    initials: "CF",
    relationship: "host",
    relationshipLabel: "Host",
    summary: "Host · Space resets",
    state: { label: "On site", tone: "healthy" },
    upcomingAccess: 0,
    confirmedExperiences: 2,
    timeline: [],
  },
];

export const VENDORS: Vendor[] = [
  {
    id: "vendor-sol-provisions",
    name: "Sol Provisions",
    category: "Supplies",
    state: { label: "In transit", tone: "attention" },
    activeJobs: 2,
    outstandingMinor: 148000,
    currency: CURRENCY,
    contactLabel: "Community partner",
    jobs: [
      {
        id: "j1",
        title: "Supplies delivery",
        detail: "Kitchen · confirm list",
        at: at("2026-07-26T16:00:00Z"),
        displayPrecision: "minute",
        tone: "attention",
      },
      {
        id: "j2",
        title: "Invoice overdue",
        detail: "€1,480 · 6 days",
        at: at("2026-07-20T10:00:00Z"),
        displayPrecision: "none",
        tone: "critical",
      },
    ],
  },
  {
    id: "vendor-aqua",
    name: "Aqua Systems",
    category: "Upkeep",
    state: { label: "Active", tone: "healthy" },
    activeJobs: 1,
    outstandingMinor: 62000,
    currency: CURRENCY,
    contactLabel: "Upkeep partner",
    jobs: [
      {
        id: "j1",
        title: "Pool system upkeep",
        detail: "Can Verde",
        at: at("2026-07-26T13:30:00Z"),
        displayPrecision: "none",
        tone: "healthy",
      },
    ],
  },
  {
    id: "vendor-clima",
    name: "Clima Ibiza",
    category: "Upkeep",
    state: { label: "Blocked", tone: "critical" },
    activeJobs: 1,
    outstandingMinor: 0,
    currency: CURRENCY,
    contactLabel: "Awaiting parts",
    jobs: [
      {
        id: "j1",
        title: "AC repair",
        detail: "Roca Llisa · awaiting parts",
        at: at("2026-07-27T09:00:00Z"),
        displayPrecision: "none",
        tone: "critical",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Experiences
 * ------------------------------------------------------------------ */

export const EXPERIENCES: Experience[] = [
  {
    id: "exp-501",
    title: "Founders’ dinner",
    summary: "Long table dinner for the founding circle",
    startAt: at("2026-07-26T17:30:00Z"),
    displayPrecision: "minute",
    spaceName: "Terrace",
    state: { label: "Confirmed", tone: "healthy" },
    rsvpConfirmed: 12,
    rsvpCapacity: 12,
    budgetSpentMinor: 280000,
    budgetTotalMinor: 320000,
    currency: CURRENCY,
    partner: "Sol Provisions",
    notes: "Dress code: Smart casual",
    published: true,
  },
  {
    id: "exp-502",
    title: "Morning breathwork",
    summary: "Guided session on the garden deck",
    startAt: at("2026-07-27T06:30:00Z"),
    displayPrecision: "minute",
    spaceName: "Garden deck",
    state: { label: "Open", tone: "neutral" },
    rsvpConfirmed: 8,
    rsvpCapacity: 12,
    budgetSpentMinor: 0,
    budgetTotalMinor: 40000,
    currency: CURRENCY,
    published: true,
  },
  {
    id: "exp-503",
    title: "Civic Tech Summit",
    summary: "Two-day programme with external partners",
    startAt: at("2026-08-03T08:00:00Z"),
    displayPrecision: "day",
    spaceName: "Convention hall",
    state: { label: "Draft", tone: "critical" },
    rsvpConfirmed: 0,
    rsvpCapacity: 80,
    budgetSpentMinor: 0,
    budgetTotalMinor: 1200000,
    currency: CURRENCY,
    published: false,
  },
];

/* ------------------------------------------------------------------ *
 * Dues
 * ------------------------------------------------------------------ */

export const TRANSACTIONS: Transaction[] = [
  {
    id: "tx-460",
    title: "€850 contribution due",
    detail: "Contribution",
    amountMinor: 85000,
    currency: CURRENCY,
    direction: "incoming",
    settlement: "outstanding",
    state: { label: "Due today", tone: "attention" },
    at: at("2026-07-26T16:30:00Z"),
    displayPrecision: "none",
    personName: "Ana Martins",
    activity: [
      { id: "a1", title: "Contribution scheduled", at: at("2026-07-20T09:00:00Z"), displayPrecision: "none" },
    ],
  },
  {
    id: "tx-455",
    title: "Sol Provisions",
    detail: "Supplies",
    amountMinor: 148000,
    currency: CURRENCY,
    direction: "outgoing",
    settlement: "outstanding",
    state: { label: "Overdue", tone: "critical" },
    at: at("2026-07-20T10:00:00Z"),
    displayPrecision: "none",
    personName: "Sol Provisions",
    activity: [
      { id: "a1", title: "Invoice received", at: at("2026-07-14T10:00:00Z"), displayPrecision: "none" },
      {
        id: "a2",
        title: "Payment window passed",
        at: at("2026-07-20T10:00:00Z"),
        displayPrecision: "none",
        tone: "critical",
      },
    ],
  },
  {
    id: "tx-410",
    title: "Access contribution",
    detail: "Contribution",
    amountMinor: 120000,
    currency: CURRENCY,
    direction: "incoming",
    settlement: "confirmed",
    state: { label: "Confirmed", tone: "healthy" },
    at: at("2026-07-24T15:40:00Z"),
    displayPrecision: "none",
    personName: "Ana Martins",
    activity: [
      {
        id: "a1",
        title: "Payment received",
        at: at("2026-07-24T15:40:00Z"),
        displayPrecision: "none",
        tone: "healthy",
      },
    ],
  },
  {
    id: "tx-471",
    title: "Upkeep partner payment",
    detail: "Upkeep",
    amountMinor: 62000,
    currency: CURRENCY,
    direction: "outgoing",
    settlement: "scheduled",
    state: { label: "Scheduled", tone: "neutral" },
    at: at("2026-07-30T08:00:00Z"),
    displayPrecision: "none",
    personName: "Aqua Systems",
    activity: [],
  },
  {
    id: "tx-470",
    title: "Monthly stewardship",
    detail: "Community partner",
    amountMinor: 240000,
    currency: CURRENCY,
    direction: "incoming",
    settlement: "forecast",
    state: { label: "Forecast", tone: "neutral" },
    at: at("2026-07-28T08:00:00Z"),
    displayPrecision: "none",
    activity: [],
  },
];

/* ------------------------------------------------------------------ *
 * Communications, content, knowledge, reports, agents, settings
 * ------------------------------------------------------------------ */

export const COMMUNICATIONS: Communication[] = [
  {
    id: "com-1",
    subject: "August programme announcement",
    detail: "Draft · 142 recipients",
    channel: "broadcast",
    state: { label: "Needs review", tone: "attention" },
    audience: "All members",
    at: at("2026-07-26T08:00:00Z"),
  },
  {
    id: "com-2",
    subject: "Arrival details — Roca Llisa",
    detail: "Sent · 3 recipients",
    channel: "direct",
    state: { label: "Sent", tone: "healthy" },
    audience: "Ana Martins + 2",
    at: at("2026-07-25T17:00:00Z"),
  },
  {
    id: "com-3",
    subject: "Berth availability update",
    detail: "Scheduled for 28 Jul",
    channel: "email",
    state: { label: "Scheduled", tone: "neutral" },
    audience: "Marina programme",
    at: at("2026-07-28T09:00:00Z"),
  },
];

export const CONTENT: ContentItem[] = [
  { id: "ct-1", title: "Gate pages", detail: "3 published · 1 draft", state: { label: "1 draft", tone: "attention" } },
  { id: "ct-2", title: "Space profiles", detail: "5 published", state: { label: "Published", tone: "healthy" } },
  { id: "ct-3", title: "Experience listings", detail: "2 published · 1 draft", state: { label: "1 draft", tone: "attention" } },
  { id: "ct-4", title: "Media library", detail: "184 assets", state: { label: "Synced", tone: "healthy" } },
];

export const KNOWLEDGE: KnowledgeNode[] = [
  {
    id: "kb-1",
    title: "Access handoff procedure",
    detail: "How an arrival is verified and handed over",
    updatedAt: at("2026-07-22T10:00:00Z"),
    tags: ["access", "operations"],
  },
  {
    id: "kb-2",
    title: "Space reset standard",
    detail: "What a Space reset covers before the next access period",
    updatedAt: at("2026-07-19T10:00:00Z"),
    tags: ["upkeep"],
  },
  {
    id: "kb-3",
    title: "Contribution and dues policy",
    detail: "Contribution schedule, outstanding balances and refunds",
    updatedAt: at("2026-07-11T10:00:00Z"),
    tags: ["dues"],
  },
  {
    id: "kb-4",
    title: "Berth allocation rules",
    detail: "How berths are allocated across the marina programme",
    updatedAt: at("2026-07-05T10:00:00Z"),
    tags: ["spaces", "marina"],
  },
];

export const REPORTS: ReportSummary[] = [
  {
    id: "rep-1",
    title: "Utilization by Space",
    detail: "Last 30 days",
    metrics: [
      { key: "u1", label: "Roca Llisa", value: "78%", raw: 78, kind: "ratio" },
      { key: "u2", label: "Can Verde", value: "54%", raw: 54, kind: "ratio" },
      { key: "u3", label: "North pontoon", value: "41%", raw: 41, kind: "ratio" },
      { key: "u4", label: "Terrace studio", value: "92%", raw: 92, kind: "ratio" },
    ],
  },
  {
    id: "rep-2",
    title: "Money movement",
    detail: "Last 30 days",
    metrics: [
      { key: "m1", label: "Received", value: "€34,800", raw: 3480000, kind: "confirmed" },
      { key: "m2", label: "Outstanding", value: "€8,250", raw: 825000, kind: "outstanding" },
      { key: "m3", label: "Expenses", value: "€12,400", raw: 1240000, kind: "expense" },
      { key: "m4", label: "Forecast", value: "€128,420", raw: 12842000, kind: "forecast" },
    ],
  },
  {
    id: "rep-3",
    title: "Access pathway conversion",
    detail: "Applications through to approved access",
    metrics: [
      { key: "c1", label: "Applications", value: "18", raw: 18, kind: "count" },
      { key: "c2", label: "Screened", value: "11", raw: 11, kind: "count" },
      { key: "c3", label: "Approved", value: "7", raw: 7, kind: "count" },
      { key: "c4", label: "Arrived", value: "5", raw: 5, kind: "count" },
    ],
  },
];

export const AGENTS: AgentEntry[] = [
  {
    id: "ag-collecta",
    name: "Collecta",
    detail: "Operator assistant",
    state: { label: "Active", tone: "healthy" },
    scopes: ["Read operations", "Draft changes", "Never confirms alone"],
  },
  {
    id: "ag-mcp",
    name: "MCP surface",
    detail: "Tool access for external agents",
    state: { label: "Restricted", tone: "attention" },
    scopes: ["Read-only", "Audit logged"],
  },
  {
    id: "ag-digest",
    name: "Daily digest",
    detail: "Morning summary to operators",
    state: { label: "Scheduled", tone: "neutral" },
    scopes: ["Read operations"],
  },
];

export const SETTINGS: SettingsGroup[] = [
  {
    id: "sg-account",
    label: "Account",
    rows: [
      { id: "s1", label: "Operator profile", detail: "Alex S.", kind: "navigation", href: "/settings" },
      { id: "s2", label: "Notifications", kind: "toggle", enabled: true },
      { id: "s3", label: "Reduced motion", detail: "Follow system", kind: "select", value: "System" },
    ],
  },
  {
    id: "sg-collective",
    label: "Collective",
    rows: [
      { id: "s4", label: "Gates & access rules", kind: "navigation", href: "/gates" },
      { id: "s5", label: "Currency", kind: "select", value: "EUR" },
      { id: "s6", label: "Operating timezone", kind: "select", value: "Europe/Madrid" },
    ],
  },
  {
    id: "sg-system",
    label: "System",
    rows: [
      { id: "s7", label: "Agents & MCP", kind: "navigation", href: "/agents", badge: 1 },
      { id: "s8", label: "Audit trail", kind: "navigation", href: "/reports" },
      { id: "s9", label: "Sign out", kind: "navigation" },
    ],
  },
];

export const MORE_GROUPS: MoreGroup[] = [
  {
    id: "mg-operate",
    label: "Operate",
    items: [
      { id: "m1", label: "Requests", href: "/requests", icon: "inbox", badge: 3 },
      { id: "m2", label: "Applications", href: "/requests?filter=applications", icon: "user-plus", badge: 3 },
      { id: "m3", label: "Partners & crew", href: "/vendors", icon: "users-round" },
      { id: "m4", label: "Communications", href: "/communications", icon: "message-square", badge: 1 },
    ],
  },
  {
    id: "mg-spaces",
    label: "Spaces",
    items: [
      { id: "m5", label: "Gates & Spaces", href: "/gates", icon: "landmark" },
      { id: "m6", label: "Areas & closures", href: "/spaces", icon: "layout-grid" },
      { id: "m7", label: "Content", href: "/content", icon: "file-text" },
    ],
  },
  {
    id: "mg-intelligence",
    label: "Intelligence",
    items: [
      { id: "m8", label: "Daily briefing", href: "/briefing", icon: "sun" },
      { id: "m9", label: "Dues", href: "/dues", icon: "euro" },
      { id: "m10", label: "Knowledge base", href: "/knowledge", icon: "book-open" },
      { id: "m11", label: "Reports", href: "/reports", icon: "bar-chart-3" },
    ],
  },
  {
    id: "mg-system",
    label: "System",
    items: [
      { id: "m12", label: "Agents & MCP", href: "/agents", icon: "terminal" },
      { id: "m13", label: "Settings", href: "/settings", icon: "settings" },
    ],
  },
];

/* The signed-in operator. No real contact details — the address below is a
   documentation domain reserved by RFC 2606. */
export const OPERATOR: OperatorAccount = {
  id: "operator-alex",
  name: "Alex Sidarau",
  initials: "AS",
  email: "alex@example.org",
  emailVerified: true,
  roleLabel: "Operator · full access",
  connections: [
    {
      id: "calendar",
      label: "Calendar",
      detail: "Arrivals, departures and experiences",
      icon: "calendar-days",
      state: { label: "Connected", tone: "healthy" },
    },
    {
      id: "email",
      label: "Email",
      detail: "alex@example.org",
      icon: "message-square",
      state: { label: "Verified", tone: "healthy" },
    },
    {
      id: "agents",
      label: "Agents & MCP",
      detail: "Collecta and tool access",
      icon: "terminal",
      href: "/agents",
      state: { label: "Restricted", tone: "attention" },
    },
    {
      id: "settings",
      label: "Settings",
      detail: "Preferences, currency, timezone",
      icon: "settings",
      href: "/settings",
      state: { label: "", tone: "neutral" },
    },
  ],
};

export const COMPOSER_OPTIONS: ComposerOption[] = [
  { kind: "request", label: "Request or follow-up", detail: "Access request, application or follow-up", icon: "inbox" },
  { kind: "access", label: "Access period or movement", detail: "Arrival, departure or access period", icon: "key-round" },
  { kind: "space_reset", label: "Space reset or upkeep", detail: "Reset, inspection, repair or supplies", icon: "wrench" },
  { kind: "due", label: "Due or expense", detail: "Contribution, expense or invoice", icon: "euro" },
  { kind: "experience", label: "Experience or event", detail: "Dinner, session or programme", icon: "utensils" },
  { kind: "note", label: "Note", detail: "A note against a person, Space or day", icon: "sticky-note" },
];
