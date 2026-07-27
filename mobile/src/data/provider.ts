/**
 * The single seam between the UI and its data.
 *
 * PHASE 1: `createFixtureProvider` returns typed fixtures and can simulate
 * every load state through a `Scenario`. No network, no Supabase, no MCP.
 *
 * PHASE 2 (Kimi): implement `MobileDataProvider` against permission-checked
 * domain services and return it from `getProvider()`. Delete nothing else.
 * The scenario switch should stay — it is how the design gallery and the
 * Playwright edge-state suite render empty/error/offline without a backend.
 */

import type {
  AccessRequest,
  AgentEntry,
  CollectaContext,
  CollectaTurn,
  Communication,
  ComposerOption,
  ContentItem,
  DaySummary,
  Experience,
  ForecastSeries,
  Gate,
  KnowledgeNode,
  LinkTarget,
  LinkTargetKind,
  MobileDataProvider,
  MoreGroup,
  NumbersOfTheDay,
  OperatorAccount,
  NumbersPeriod,
  OperationCategory,
  OperationEvent,
  Person,
  ReportSummary,
  Result,
  Scenario,
  SettingsGroup,
  Space,
  TimelinePage,
  TimelineQuery,
  Transaction,
  Vendor,
} from "./contracts";
import {
  AGENTS,
  BUSY_TIMELINE_EVENTS,
  COMMUNICATIONS,
  COMPOSER_OPTIONS,
  CONTENT,
  DAY_SUMMARY,
  EXPERIENCES,
  FIXTURE_NOW,
  FORECAST,
  GATES,
  KNOWLEDGE,
  MORE_GROUPS,
  OPERATOR,
  PEOPLE,
  REPORTS,
  REQUESTS,
  SETTINGS,
  SPACES,
  TIMELINE_EVENTS,
  TRANSACTIONS,
  VENDORS,
  numbersFor,
} from "./fixtures";

const ok = <T,>(data: T): Result<T> => ({ status: "ok", data });

/** Keeps scripted Collecta message ids unique across turns in a session. */
let collectaTurnCounter = 0;

/**
 * Non-healthy scenarios short-circuit every read so each screen can be seen
 * in all five load states without special-casing individual components.
 */
function scenarioShortCircuit<T>(scenario: Scenario): Result<T> | null {
  switch (scenario) {
    case "empty":
      return { status: "empty" };
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error", message: "Operations could not be loaded." };
    case "offline":
      return { status: "offline" };
    default:
      return null;
  }
}

const byId = <T extends { id: string }>(rows: T[], id: string): Result<T> => {
  const found = rows.find((r) => r.id === id);
  return found ? ok(found) : { status: "empty" };
};

/* ------------------------------------------------------------------ *
 * Timeline assembly — MOBILE_UI_SPEC.md §5 "Ordering"
 * ------------------------------------------------------------------ */

const rank = (e: OperationEvent) =>
  e.priority === "critical" ? 0 : e.priority === "attention" ? 1 : 2;

/**
 * Orders a page of events. Completed work sits above the present in reverse
 * chronology; overdue incomplete work is lifted to just above the present so
 * it never disappears into history.
 */
export function orderTimeline(events: OperationEvent[], nowIso: string): OperationEvent[] {
  const now = Date.parse(nowIso);

  const isCarried = (e: OperationEvent) =>
    Boolean(e.carriedFrom) && e.status !== "complete";

  const history = events
    .filter((e) => !isCarried(e) && Date.parse(e.sortAt) < now)
    .sort((a, b) => Date.parse(a.sortAt) - Date.parse(b.sortAt));

  const carried = events
    .filter(isCarried)
    .sort((a, b) => rank(a) - rank(b) || Date.parse(a.sortAt) - Date.parse(b.sortAt));

  // `sortAt` controls placement (MOBILE_UI_SPEC.md §5), so the day reads as
  // one chronology. The spec's timed-then-untimed and priority rules break
  // ties between items that share an instant.
  const upcoming = events
    .filter((e) => !isCarried(e) && Date.parse(e.sortAt) >= now)
    .sort((a, b) => {
      const delta = Date.parse(a.sortAt) - Date.parse(b.sortAt);
      if (delta !== 0) return delta;
      const aTimed = a.displayPrecision === "minute";
      const bTimed = b.displayPrecision === "minute";
      if (aTimed !== bTimed) return aTimed ? -1 : 1;
      return rank(a) - rank(b);
    });

  return [...history, ...carried, ...upcoming];
}

/** Index of the first item at or after the present — where the view lands. */
export function presentIndex(ordered: OperationEvent[], nowIso: string): number {
  const now = Date.parse(nowIso);
  const idx = ordered.findIndex(
    (e) => !e.carriedFrom && Date.parse(e.sortAt) >= now,
  );
  return idx === -1 ? ordered.length : idx;
}

/* ------------------------------------------------------------------ *
 * Fixture provider
 * ------------------------------------------------------------------ */

export function createFixtureProvider(scenario: Scenario = "healthy"): MobileDataProvider {
  const guard = <T,>(value: T): Result<T> =>
    scenarioShortCircuit<T>(scenario) ?? ok(value);

  const guardList = <T,>(rows: T[]): Result<T[]> => {
    const short = scenarioShortCircuit<T[]>(scenario);
    if (short) return short;
    return rows.length ? ok(rows) : { status: "empty" };
  };

  return {
    name: `fixtures:${scenario}`,

    async getDaySummary(): Promise<Result<DaySummary>> {
      const short = scenarioShortCircuit<DaySummary>(scenario);
      if (short) return short;
      // "empty" is a load state; a genuinely quiet day is still an ok result.
      return ok(DAY_SUMMARY);
    },

    async getNumbers(period: NumbersPeriod): Promise<Result<NumbersOfTheDay>> {
      return guard(numbersFor(period));
    },

    async getForecast(period: NumbersPeriod): Promise<Result<ForecastSeries>> {
      return guard(FORECAST[period]);
    },

    async getTimeline(query: TimelineQuery): Promise<Result<TimelinePage>> {
      const short = scenarioShortCircuit<TimelinePage>(scenario);
      if (short) return short;

      const source = scenario === "busy" ? BUSY_TIMELINE_EVENTS : TIMELINE_EVENTS;
      const category = query.category ?? "all";
      const filtered =
        category === "all"
          ? source
          : source.filter((e) => e.category === (category as OperationCategory));

      if (!filtered.length) return { status: "empty" };

      const ordered = orderTimeline(filtered, FIXTURE_NOW);
      return ok({
        events: ordered,
        olderCursor: ordered.length ? ordered[0].sortAt : null,
        newerCursor: ordered.length ? ordered[ordered.length - 1].sortAt : null,
        // Phase 1 serves one page; the cursors exist so Phase 2 can paginate
        // without changing a single call site.
        hasOlder: true,
        hasNewer: true,
      });
    },

    async listRequests(filter?: string): Promise<Result<AccessRequest[]>> {
      const rows =
        !filter || filter === "all"
          ? REQUESTS
          : REQUESTS.filter((r) =>
              filter === "applications"
                ? r.kind === "application"
                : filter === "access"
                  ? r.kind === "access_request"
                  : r.kind === "follow_up",
            );
      return guardList(rows);
    },
    async getRequest(id: string) {
      return scenarioShortCircuit<AccessRequest>(scenario) ?? byId(REQUESTS, id);
    },

    async listSpaces(): Promise<Result<Space[]>> {
      return guardList(SPACES);
    },
    async getSpace(id: string) {
      return scenarioShortCircuit<Space>(scenario) ?? byId(SPACES, id);
    },

    async listGates(): Promise<Result<Gate[]>> {
      return guardList(GATES);
    },
    async getGate(id: string) {
      return scenarioShortCircuit<Gate>(scenario) ?? byId(GATES, id);
    },

    async listTransactions(filter?: string): Promise<Result<Transaction[]>> {
      const rows =
        !filter || filter === "all"
          ? TRANSACTIONS
          : filter === "incoming"
            ? TRANSACTIONS.filter((t) => t.direction === "incoming")
            : filter === "outgoing"
              ? TRANSACTIONS.filter((t) => t.direction === "outgoing")
              : TRANSACTIONS.filter((t) => t.settlement === "outstanding");
      return guardList(rows);
    },
    async getTransaction(id: string) {
      return scenarioShortCircuit<Transaction>(scenario) ?? byId(TRANSACTIONS, id);
    },

    async listExperiences(): Promise<Result<Experience[]>> {
      return guardList(EXPERIENCES);
    },
    async getExperience(id: string) {
      return scenarioShortCircuit<Experience>(scenario) ?? byId(EXPERIENCES, id);
    },

    async listPeople(relationship?: string): Promise<Result<Person[]>> {
      const rows =
        !relationship || relationship === "all"
          ? PEOPLE
          : PEOPLE.filter((p) => p.relationship === relationship);
      return guardList(rows);
    },
    async getPerson(id: string) {
      return scenarioShortCircuit<Person>(scenario) ?? byId(PEOPLE, id);
    },

    async listVendors(): Promise<Result<Vendor[]>> {
      return guardList(VENDORS);
    },
    async getVendor(id: string) {
      return scenarioShortCircuit<Vendor>(scenario) ?? byId(VENDORS, id);
    },

    async listCommunications(): Promise<Result<Communication[]>> {
      return guardList(COMMUNICATIONS);
    },
    async listContent(): Promise<Result<ContentItem[]>> {
      return guardList(CONTENT);
    },
    async listKnowledge(): Promise<Result<KnowledgeNode[]>> {
      return guardList(KNOWLEDGE);
    },
    async listReports(): Promise<Result<ReportSummary[]>> {
      return guardList(REPORTS);
    },
    async listAgents(): Promise<Result<AgentEntry[]>> {
      return guardList(AGENTS);
    },

    async getOperator(): Promise<Result<OperatorAccount>> {
      return guard(OPERATOR);
    },

    async getSettings(): Promise<Result<SettingsGroup[]>> {
      return guardList(SETTINGS);
    },
    async getMoreGroups(): Promise<Result<MoreGroup[]>> {
      return guardList(MORE_GROUPS);
    },

    getComposerOptions(): ComposerOption[] {
      return COMPOSER_OPTIONS;
    },

    async searchLinkTargets(
      query: string,
      kinds?: LinkTargetKind[],
    ): Promise<Result<LinkTarget[]>> {
      const short = scenarioShortCircuit<LinkTarget[]>(scenario);
      if (short) return short;

      const all: LinkTarget[] = [
        ...SPACES.map((s) => ({
          id: s.id,
          kind: "space" as const,
          label: s.name,
          detail: s.summary,
          href: `/spaces/${s.id}`,
        })),
        ...PEOPLE.map((p) => ({
          id: p.id,
          kind: "person" as const,
          label: p.name,
          detail: p.relationshipLabel,
          href: `/people/${p.id}`,
        })),
        ...VENDORS.map((v) => ({
          id: v.id,
          kind: "vendor" as const,
          label: v.name,
          detail: `${v.contactLabel} · ${v.category}`,
          href: `/vendors/${v.id}`,
        })),
        ...EXPERIENCES.map((e) => ({
          id: e.id,
          kind: "experience" as const,
          label: e.title,
          detail: e.spaceName,
          href: `/experiences/${e.id}`,
        })),
        ...GATES.map((g) => ({
          id: g.id,
          kind: "gate" as const,
          label: g.name,
          detail: g.summary,
          href: `/gates/${g.id}`,
        })),
      ];

      const q = query.trim().toLowerCase();
      const rows = all
        .filter((t) => !kinds?.length || kinds.includes(t.kind))
        .filter(
          (t) =>
            !q ||
            t.label.toLowerCase().includes(q) ||
            (t.detail ?? "").toLowerCase().includes(q),
        );

      return rows.length ? ok(rows) : { status: "empty" };
    },

    async askCollecta(context: CollectaContext, prompt: string): Promise<CollectaTurn> {
      // Phase 1 is scripted. Phase 2 must re-fetch every id in `context`
      // server-side and never trust client-supplied record content.
      const wantsPublish = /publish/i.test(prompt);
      const now = FIXTURE_NOW;
      // Ids must be unique per turn — the thread appends and dedupes on them.
      const turn = `t${(collectaTurnCounter += 1)}`;

      if (wantsPublish) {
        return {
          state: "draft",
          messages: [
            { id: `${turn}-operator`, role: "operator", body: prompt, at: now },
            {
              id: `${turn}-collecta`,
              role: "collecta",
              body: "I can publish Founders’ dinner. Review the details before I do.",
              at: now,
            },
          ],
          draft: {
            id: "draft-publish-501",
            title: "Publish Founders’ dinner?",
            detail: "26 Jul · 19:30 · Terrace",
            facts: [
              { label: "Experience", value: "Founders’ dinner" },
              { label: "Space", value: "Terrace" },
              { label: "Capacity", value: "12 people" },
              { label: "Current state", value: "Draft" },
            ],
            confirmLabel: "Publish",
            requiresConfirmation: true,
          },
        };
      }

      return {
        state: "answer",
        messages: [
          { id: `${turn}-operator`, role: "operator", body: prompt, at: now },
          {
            id: `${turn}-collecta`,
            role: "collecta",
            body:
              context.selectedEventId
                ? "That item is scheduled for tomorrow morning and the partner has confirmed."
                : "Three decisions need you today: one access request, one supplies list and one overdue invoice.",
            at: now,
          },
        ],
      };
    },
  };
}

/** Resolves the active provider. Phase 2 swaps the implementation here. */
export function getProvider(scenario: Scenario = "healthy"): MobileDataProvider {
  return createFixtureProvider(scenario);
}

/** Narrows an unknown search param to a Scenario. */
export function parseScenario(value: string | string[] | undefined): Scenario {
  const raw = Array.isArray(value) ? value[0] : value;
  const allowed: Scenario[] = ["healthy", "empty", "loading", "error", "offline", "busy"];
  return allowed.includes(raw as Scenario) ? (raw as Scenario) : "healthy";
}
