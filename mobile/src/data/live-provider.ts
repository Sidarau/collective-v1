import "server-only";

/**
 * Live provider — Phase 2's implementation of `MobileDataProvider`.
 *
 * Every read goes through the service-role Supabase client on the server,
 * after the session guard has authorized the operator. Failures map to the
 * contract's `error`/`empty` results; nothing throws past this boundary.
 */

import { getOperatorPrincipal } from "@/lib/guard";
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
  NumbersPeriod,
  OperatorAccount,
  Person,
  ReportSummary,
  Result,
  SettingsGroup,
  Space,
  TimelinePage,
  TimelineQuery,
  Transaction,
  Vendor,
} from "./contracts";
import { COMPOSER_OPTIONS } from "./composer-options";
import { MORE_GROUPS, SETTINGS } from "./fixtures";
import { compareKey, decodeCursor, encodeCursor, orderTimeline } from "./timeline";
import { mapOperatorAccount, CURRENCY, dayOf } from "./mappers";
import { answerCollecta } from "./collecta";
import * as live from "./live-data";

const ok = <T,>(data: T): Result<T> => ({ status: "ok", data });
const empty = <T,>(): Result<T> => ({ status: "empty" });
const err = <T,>(message: string): Result<T> => ({ status: "error", message });

function fail<T>(e: unknown, what: string): Result<T> {
  console.error(`[live-provider] ${what}:`, e instanceof Error ? e.message : e);
  return err(`${what} could not be loaded.`);
}

const TIMELINE_PAGE_SIZE = 40;

export function createLiveProvider(): MobileDataProvider {
  const nowIso = () => new Date().toISOString();

  return {
    name: "supabase:live",

    async getDaySummary(): Promise<Result<DaySummary>> {
      try {
        const core = await live.fetchCoreData();
        const now = nowIso();
        const today = dayOf(now);
        const arrivals = core.bookings.filter(
          (b) => dayOf(b.check_in) === today && !["inquiry", "cancelled"].includes(b.status),
        ).length;
        const departures = core.bookings.filter(
          (b) => dayOf(b.check_out) === today && !["inquiry", "cancelled"].includes(b.status),
        ).length;
        const requests =
          core.bookings.filter((b) => b.status === "requested").length +
          core.applications.filter((a) => a.status === "submitted").length;
        const paid = live.paidByBooking(core.payments);
        let dueMinor = 0;
        for (const b of core.bookings) {
          if (["inquiry", "cancelled"].includes(b.status)) continue;
          // Amounts are already minor units — never rescale (the 100x bug).
          dueMinor += Math.max(0, Math.round(b.total_price ?? 0) - (paid.get(b.id) ?? 0));
        }
        const startOfDay = `${today}T00:00:00.000Z`;
        const incomingMinor = core.payments
          .filter((p) => p.received_at >= startOfDay && p.kind !== "refund")
          .reduce((n, p) => n + Math.round(p.amount ?? 0), 0);

        return ok({
          isoDate: today,
          arrivals,
          departures,
          requests,
          upkeep: 0, // no upkeep task table yet — honest zero, not an invented count
          supplies: 0,
          dueMinor,
          incomingMinor,
          currency: CURRENCY,
        });
      } catch (e) {
        return fail(e, "Today");
      }
    },

    async getNumbers(period: NumbersPeriod): Promise<Result<NumbersOfTheDay>> {
      try {
        const core = await live.fetchCoreData();
        return ok(live.buildNumbers(core, period, nowIso()));
      } catch (e) {
        return fail(e, "Numbers");
      }
    },

    async getForecast(period: NumbersPeriod): Promise<Result<ForecastSeries>> {
      try {
        const core = await live.fetchCoreData();
        return ok(live.buildForecastSeries(core, period, nowIso()));
      } catch (e) {
        return fail(e, "Forecast");
      }
    },

    async getTimeline(query: TimelineQuery): Promise<Result<TimelinePage>> {
      try {
        const core = await live.fetchCoreData();
        const now = nowIso();
        const all = live
          .buildTimelineEvents(core, now)
          .filter((e) => !query.category || query.category === "all" || e.category === query.category);

        if (!all.length) return empty();

        // Keyset order = (sortAt, id); display order comes from orderTimeline.
        const keyed = [...all].sort(compareKey);
        const limit = query.limit ?? TIMELINE_PAGE_SIZE;
        const anchor = query.cursor ? decodeCursor(query.cursor) : null;
        const direction = query.direction ?? "around";

        let page: typeof keyed;
        if (anchor && direction === "older") {
          page = keyed.filter((e) => compareKey(e, anchor) < 0).slice(-limit);
        } else if (anchor && direction === "newer") {
          page = keyed.filter((e) => compareKey(e, anchor) > 0).slice(0, limit);
        } else if (anchor && direction === "around") {
          const at = keyed.findIndex((e) => compareKey(e, anchor) >= 0);
          const center = at === -1 ? keyed.length : at;
          const before = Math.floor(limit * 0.38); // lands the anchor at ~38% of the viewport
          page = keyed.slice(Math.max(0, center - before), center - before + limit);
        } else {
          // No cursor: center on the present.
          const at = keyed.findIndex((e) => e.sortAt >= now);
          const center = at === -1 ? keyed.length : at;
          const before = Math.floor(limit * 0.38);
          page = keyed.slice(Math.max(0, center - before), center - before + limit);
        }

        if (!page.length) return empty();

        const first = page[0];
        const last = page[page.length - 1];
        return ok({
          // Display ordering (carried-forward lift, history/present split) is
          // presentation, not pagination — reuse the tested assembly.
          events: orderTimeline(page, now),
          olderCursor: encodeCursor(first.sortAt, first.id),
          newerCursor: encodeCursor(last.sortAt, last.id),
          hasOlder: compareKey(first, keyed[0]) > 0,
          hasNewer: compareKey(last, keyed[keyed.length - 1]) < 0,
        });
      } catch (e) {
        return fail(e, "The operation stream");
      }
    },

    async listRequests(filter?: string): Promise<Result<AccessRequest[]>> {
      try {
        const core = await live.fetchCoreData();
        const rows = live.buildRequests(core).filter((r) => {
          if (!filter || filter === "all") return true;
          if (filter === "applications") return r.kind === "application";
          if (filter === "access") return r.kind === "access_request";
          return r.kind === "follow_up";
        });
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Requests");
      }
    },
    async getRequest(id: string): Promise<Result<AccessRequest>> {
      try {
        const core = await live.fetchCoreData();
        const found = live.buildRequests(core).find((r) => r.id === id);
        return found ? ok(found) : empty();
      } catch (e) {
        return fail(e, "This request");
      }
    },

    async listSpaces(): Promise<Result<Space[]>> {
      try {
        const core = await live.fetchCoreData();
        const rows = live.buildSpaces(core, nowIso());
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Spaces");
      }
    },
    async getSpace(id: string): Promise<Result<Space>> {
      try {
        const core = await live.fetchCoreData();
        const spaces = live.buildSpaces(core, nowIso());
        const found = spaces.find((s) => s.id === id);
        if (!found) return empty();
        // Space detail carries its own upkeep stream: this gate's timeline.
        const events = live
          .buildTimelineEvents(core, nowIso())
          .filter((e) => e.href === `/spaces/${id}` || e.href.startsWith(`/spaces/${id}/`));
        return ok({ ...found, upkeep: orderTimeline(events, nowIso()) });
      } catch (e) {
        return fail(e, "This Space");
      }
    },

    async listGates(): Promise<Result<Gate[]>> {
      try {
        const core = await live.fetchCoreData();
        const rows = live.buildGates(core, live.buildRequests(core));
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Gates");
      }
    },
    async getGate(id: string): Promise<Result<Gate>> {
      try {
        const core = await live.fetchCoreData();
        const found = live.buildGates(core, live.buildRequests(core)).find((g) => g.id === id);
        return found ? ok(found) : empty();
      } catch (e) {
        return fail(e, "This Gate");
      }
    },

    async listTransactions(filter?: string): Promise<Result<Transaction[]>> {
      try {
        const core = await live.fetchCoreData();
        const rows = live.buildTransactions(core).filter((t) => {
          if (!filter || filter === "all") return true;
          if (filter === "incoming") return t.direction === "incoming";
          if (filter === "outgoing") return t.direction === "outgoing";
          return t.settlement === "outstanding";
        });
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Dues");
      }
    },
    async getTransaction(id: string): Promise<Result<Transaction>> {
      try {
        const core = await live.fetchCoreData();
        const found = live.buildTransactions(core).find((t) => t.id === id);
        return found ? ok(found) : empty();
      } catch (e) {
        return fail(e, "This transaction");
      }
    },

    async listExperiences(): Promise<Result<Experience[]>> {
      try {
        const core = await live.fetchCoreData();
        const rows = live.buildExperiences(core);
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Experiences");
      }
    },
    async getExperience(id: string): Promise<Result<Experience>> {
      try {
        const core = await live.fetchCoreData();
        const found = live.buildExperiences(core).find((x) => x.id === id);
        return found ? ok(found) : empty();
      } catch (e) {
        return fail(e, "This experience");
      }
    },

    async listPeople(relationship?: string): Promise<Result<Person[]>> {
      try {
        const core = await live.fetchCoreData();
        const rows = live
          .buildPeople(core)
          .filter((p) => !relationship || relationship === "all" || p.relationship === relationship);
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "People");
      }
    },
    async getPerson(id: string): Promise<Result<Person>> {
      try {
        const core = await live.fetchCoreData();
        const found = live.buildPeople(core).find((p) => p.id === id);
        return found ? ok(found) : empty();
      } catch (e) {
        return fail(e, "This person");
      }
    },

    async listVendors(): Promise<Result<Vendor[]>> {
      try {
        const core = await live.fetchCoreData();
        const rows = live.buildVendors(core);
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Partners & crew");
      }
    },
    async getVendor(id: string): Promise<Result<Vendor>> {
      try {
        const core = await live.fetchCoreData();
        const found = live.buildVendors(core).find((v) => v.id === id);
        return found ? ok(found) : empty();
      } catch (e) {
        return fail(e, "This partner");
      }
    },

    async listCommunications(): Promise<Result<Communication[]>> {
      try {
        const rows = live.buildCommunications(await live.fetchCampaigns());
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Communications");
      }
    },
    async listContent(): Promise<Result<ContentItem[]>> {
      try {
        const rows = live.buildContent(await live.fetchContentBlocks());
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Content");
      }
    },
    async listKnowledge(): Promise<Result<KnowledgeNode[]>> {
      try {
        const rows = live.buildKnowledge(await live.fetchKbNodes());
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Knowledge");
      }
    },
    async listReports(): Promise<Result<ReportSummary[]>> {
      try {
        const core = await live.fetchCoreData();
        return ok(live.buildReports(core, nowIso()));
      } catch (e) {
        return fail(e, "Reports");
      }
    },
    async listAgents(): Promise<Result<AgentEntry[]>> {
      try {
        const rows = live.buildAgents(await live.fetchAgentTokens());
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Agents");
      }
    },

    async getOperator(): Promise<Result<OperatorAccount>> {
      try {
        const principal = await getOperatorPrincipal();
        if (!principal) return err("No operator session.");
        const profiles = live.profileMap(await live.fetchProfiles());
        return ok(
          mapOperatorAccount({
            id: principal.id,
            email: principal.email,
            role: principal.role,
            profile: profiles.get(principal.id) ?? null,
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
                detail: principal.email,
                icon: "message-square",
                state: { label: "Verified", tone: "healthy" },
              },
              {
                id: "agents",
                label: "Agents & MCP",
                detail: "Collecta and tool access",
                icon: "terminal",
                href: "/agents",
                state: { label: principal.role === "admin" ? "Full access" : "Restricted", tone: principal.role === "admin" ? "healthy" : "attention" },
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
          }),
        );
      } catch (e) {
        return fail(e, "Your account");
      }
    },

    async getSettings(): Promise<Result<SettingsGroup[]>> {
      // Static shell settings; data-backed rows (badges) come from the reads above.
      return ok(SETTINGS);
    },
    async getMoreGroups(): Promise<Result<MoreGroup[]>> {
      try {
        const core = await live.fetchCoreData();
        // Badges must be actionable counts only (handoff contract).
        const openRequests =
          core.bookings.filter((b) => b.status === "requested").length +
          core.applications.filter((a) => a.status === "submitted").length;
        const newApplications = core.applications.filter((a) => a.status === "submitted").length;
        const draftCampaigns = (await live.fetchCampaigns()).filter((c) => c.status === "draft").length;
        const groups: MoreGroup[] = MORE_GROUPS.map((g) => ({
          ...g,
          items: g.items.map((item) => {
            if (item.id === "m1") return { ...item, badge: openRequests || undefined };
            if (item.id === "m2") return { ...item, badge: newApplications || undefined };
            if (item.id === "m4") return { ...item, badge: draftCampaigns || undefined };
            return item;
          }),
        }));
        return ok(groups);
      } catch {
        return ok(MORE_GROUPS);
      }
    },

    getComposerOptions(): ComposerOption[] {
      return COMPOSER_OPTIONS;
    },

    async searchLinkTargets(query: string, kinds?: LinkTargetKind[]): Promise<Result<LinkTarget[]>> {
      try {
        // Operators see the full network; this method is the permission
        // boundary for narrower roles when they arrive — scope it here, not
        // in the picker.
        const principal = await getOperatorPrincipal();
        if (!principal) return err("No operator session.");

        const core = await live.fetchCoreData();
        const q = query.trim().toLowerCase();
        const all: LinkTarget[] = [
          ...live.buildSpaces(core, nowIso()).map((s) => ({
            id: s.id, kind: "space" as const, label: s.name, detail: s.summary, href: `/spaces/${s.id}`,
          })),
          ...live.buildPeople(core).map((p) => ({
            id: p.id, kind: "person" as const, label: p.name, detail: p.relationshipLabel, href: `/people/${p.id}`,
          })),
          ...live.buildVendors(core).map((v) => ({
            id: v.id, kind: "vendor" as const, label: v.name, detail: `${v.contactLabel} · ${v.category}`, href: `/vendors/${v.id}`,
          })),
          ...live.buildExperiences(core).map((x) => ({
            id: x.id, kind: "experience" as const, label: x.title, detail: x.spaceName, href: `/experiences/${x.id}`,
          })),
          ...live.buildGates(core, []).map((g) => ({
            id: g.id, kind: "gate" as const, label: g.name, detail: g.summary, href: `/gates/${g.id}`,
          })),
        ];
        const rows = all
          .filter((t) => !kinds?.length || kinds.includes(t.kind))
          .filter((t) => !q || t.label.toLowerCase().includes(q) || (t.detail ?? "").toLowerCase().includes(q))
          .slice(0, 30);
        return rows.length ? ok(rows) : empty();
      } catch (e) {
        return fail(e, "Search");
      }
    },

    async askCollecta(context: CollectaContext, prompt: string): Promise<CollectaTurn> {
      const principal = await getOperatorPrincipal();
      if (!principal) {
        return {
          state: "answer",
          messages: [
            { id: `denied-${Date.now()}`, role: "collecta", body: "I need an operator session before I can answer.", at: nowIso() },
          ],
        };
      }
      return answerCollecta(context, prompt, principal);
    },
  };
}
