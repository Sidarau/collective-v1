import { describe, expect, it } from "vitest";
import { orderTimeline, presentIndex, createFixtureProvider } from "@/data/provider";
import { FIXTURE_NOW, TIMELINE_EVENTS } from "@/data/fixtures";
import { displayTime, rowTimeLabel } from "@/lib/time";
import { trailingFor } from "@/lib/presentation";
import type { OperationEvent } from "@/data/contracts";

const ordered = orderTimeline(TIMELINE_EVENTS, FIXTURE_NOW);
const idOf = (e: OperationEvent) => e.id;

describe("timeline time rules", () => {
  it("shows a clock only when displayPrecision is minute", () => {
    expect(displayTime("2026-07-26T15:30:00.000Z", "minute")).toBe("17:30");
    expect(displayTime("2026-07-26T15:30:00.000Z", "day")).toBeNull();
    expect(displayTime("2026-07-26T15:30:00.000Z", "none")).toBeNull();
  });

  it("never invents a time for applications, dues, upkeep or supplies", () => {
    const untimedKinds = [
      "application",
      "access_request",
      "contribution_due",
      "supplies",
      "upkeep",
      "space_reset",
    ];
    for (const event of TIMELINE_EVENTS) {
      if (untimedKinds.includes(event.kind)) {
        expect(
          displayTime(event.sortAt, event.displayPrecision),
          `${event.id} (${event.kind}) must not show a clock`,
        ).toBeNull();
      }
    }
  });

  it("does show a clock for arrivals, departures and experiences", () => {
    const timed = TIMELINE_EVENTS.filter((e) =>
      ["arrival", "departure", "experience", "screening_call"].includes(e.kind),
    );
    expect(timed.length).toBeGreaterThan(0);
    for (const e of timed) {
      expect(e.displayPrecision === "minute" || e.displayPrecision === "day").toBe(true);
    }
  });

  it("describes untimed rows for assistive technology without a clock", () => {
    expect(rowTimeLabel("2026-07-26T16:30:00.000Z", "none")).toBe("no scheduled time");
    expect(rowTimeLabel("2026-07-26T15:30:00.000Z", "minute")).toBe("at 17:30");
  });
});

describe("timeline ordering", () => {
  it("places completed history before the present in chronological order", () => {
    const history = ordered.filter((e) => e.status === "complete");
    const times = history.map((e) => Date.parse(e.sortAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.every((t) => t < Date.parse(FIXTURE_NOW))).toBe(true);
  });

  it("carries overdue incomplete work forward, above the present", () => {
    const carriedIdx = ordered.findIndex((e) => e.id === "ev-c-002");
    const suppliesIdx = ordered.findIndex((e) => e.id === "ev-c-001");
    const present = presentIndex(ordered, FIXTURE_NOW);

    expect(carriedIdx).toBeGreaterThan(-1);
    expect(carriedIdx).toBeLessThan(present);
    expect(suppliesIdx).toBeLessThan(present);

    // Most critical carried item leads.
    expect(carriedIdx).toBeLessThan(suppliesIdx);
  });

  it("never leaves overdue work buried in history", () => {
    const lastComplete = ordered.map(idOf).lastIndexOf("ev-h-004");
    const firstCarried = ordered.findIndex((e) => Boolean(e.carriedFrom));
    expect(firstCarried).toBeGreaterThan(lastComplete);
  });

  it("orders upcoming work by sortAt, matching the approved composition", () => {
    const present = presentIndex(ordered, FIXTURE_NOW);
    const upcoming = ordered.slice(present).map(idOf);
    expect(upcoming.slice(0, 7)).toEqual([
      "ev-001", // Access request        14:25
      "ev-002", // Space reset           14:40
      "ev-003", // Pool system upkeep    15:30
      "ev-004", // Arrival               17:30
      "ev-005", // Supplies delivery     18:00
      "ev-006", // €850 contribution due 18:30
      "ev-007", // Founders' dinner      19:30
    ]);
  });

  it("lands the present between the carried block and the first upcoming item", () => {
    const present = presentIndex(ordered, FIXTURE_NOW);
    expect(ordered[present - 1].carriedFrom).toBeTruthy();
    expect(Date.parse(ordered[present].sortAt)).toBeGreaterThanOrEqual(
      Date.parse(FIXTURE_NOW),
    );
  });
});

describe("row status presentation", () => {
  it("announces money direction as a word, not only an arrow", () => {
    const due = TIMELINE_EVENTS.find((e) => e.id === "ev-006")!;
    const t = trailingFor(due);
    expect(t.label).toBe("Incoming");
    expect(t.announcement).toContain("Incoming");
  });

  it("surfaces the pending decision as the trailing label", () => {
    const request = TIMELINE_EVENTS.find((e) => e.id === "ev-001")!;
    expect(trailingFor(request)).toMatchObject({ label: "Review", tone: "critical" });
  });

  it("uses kind-specific ready labels", () => {
    const arrival = TIMELINE_EVENTS.find((e) => e.id === "ev-004")!;
    expect(trailingFor(arrival).label).toBe("Access details ready");
    const upkeep = TIMELINE_EVENTS.find((e) => e.id === "ev-003")!;
    expect(trailingFor(upkeep).label).toBe("Scheduled");
  });
});

describe("filters", () => {
  it("returns only the requested category", async () => {
    const provider = createFixtureProvider();
    for (const category of ["requests", "access", "dues", "experiences"] as const) {
      const page = await provider.getTimeline({ category });
      expect(page.status).toBe("ok");
      if (page.status !== "ok") return;
      expect(page.data.events.length).toBeGreaterThan(0);
      expect(page.data.events.every((e) => e.category === category)).toBe(true);
    }
  });

  it("returns every event under All", async () => {
    const page = await createFixtureProvider().getTimeline({ category: "all" });
    if (page.status !== "ok") throw new Error("expected ok");
    expect(page.data.events).toHaveLength(TIMELINE_EVENTS.length);
  });

  it("keeps carried work visible inside its own category filter", async () => {
    const page = await createFixtureProvider().getTimeline({ category: "dues" });
    if (page.status !== "ok") throw new Error("expected ok");
    expect(page.data.events.map(idOf)).toContain("ev-c-002");
  });
});

describe("load states", () => {
  it("serves every edge state from the same provider interface", async () => {
    const expectations = {
      empty: "empty",
      loading: "loading",
      error: "error",
      offline: "offline",
    } as const;

    for (const [scenario, status] of Object.entries(expectations)) {
      const provider = createFixtureProvider(scenario as keyof typeof expectations);
      expect((await provider.getTimeline({})).status).toBe(status);
      expect((await provider.getDaySummary()).status).toBe(status);
      expect((await provider.listPeople()).status).toBe(status);
    }
  });

  it("serves a high-activity day", async () => {
    const page = await createFixtureProvider("busy").getTimeline({ category: "all" });
    if (page.status !== "ok") throw new Error("expected ok");
    expect(page.data.events.length).toBeGreaterThan(TIMELINE_EVENTS.length);
  });
});
