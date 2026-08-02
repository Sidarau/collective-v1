import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Collecta's live brain: money is quoted in euros exactly as stored (minor
 * units — never rescaled), the page route resolves "it/this" to the record
 * on screen, and material intents return confirmable drafts.
 */

const inserted: Record<string, unknown[]> = {};
const settleCalls: unknown[] = [];
const requestCalls: unknown[] = [];
const applicationCalls: unknown[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/data/record-actions", () => ({
  settleContribution: vi.fn(async (input: unknown) => {
    settleCalls.push(input);
    return { ok: true, message: "settled" };
  }),
  decideAccessRequest: vi.fn(async (input: unknown) => {
    requestCalls.push(input);
    return { ok: true, message: "decided" };
  }),
  decideApplication: vi.fn(async (input: unknown) => {
    applicationCalls.push(input);
    return { ok: true, message: "decided" };
  }),
}));
vi.mock("@core/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self; chain.eq = self; chain.order = self; chain.limit = self;
      chain.maybeSingle = async () => ({ data: null, error: null });
      chain.insert = (payload: Record<string, unknown>) => {
        inserted[table] = [...(inserted[table] ?? []), payload];
        return chain;
      };
      chain.update = self;
      chain.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return chain;
    },
  }),
}));

const ALEX_BOOKING = {
  id: "bk-1",
  user_id: "user-1",
  lead_id: null,
  room_id: "room-1",
  villa_id: "villa-1",
  check_in: "2026-07-08",
  check_out: "2026-07-16",
  guests: 2,
  status: "approved",
  total_price: 224000, // cents — €2,240
  currency: "EUR",
  special_requests: null,
  created_at: "2026-07-01T00:00:00Z",
};

const REQUESTED_BOOKING = {
  ...ALEX_BOOKING,
  id: "bk-2",
  status: "requested",
  check_in: "2026-08-20",
  check_out: "2026-08-23",
  total_price: 180000,
};

const core = {
  bookings: [ALEX_BOOKING, REQUESTED_BOOKING],
  payments: [],
  applications: [],
  followUps: [],
  events: [],
  villas: [{ id: "villa-1", name: "Roca Llisa" }],
  rooms: [{ id: "room-1", villa_id: "villa-1", name: "Suite" }],
  users: [{ id: "user-1", email: "alex@example.com", role: "member", lead_id: null, created_at: "" }],
  profiles: [{ user_id: "user-1", first_name: "Alex", last_name: "Sidarau" }],
  leads: [],
  staff: [],
  screeningCalls: [],
  rsvps: [],
  closures: [],
};

vi.mock("@/data/live-data", () => ({
  fetchCoreData: vi.fn(async () => core),
  paidByBooking: (payments: { kind: string; booking_id: string; amount: number }[]) => {
    const map = new Map<string, number>();
    for (const p of payments) {
      if (p.kind === "refund") continue;
      map.set(p.booking_id, (map.get(p.booking_id) ?? 0) + Math.round(p.amount ?? 0));
    }
    return map;
  },
  joinsFor: (b: (typeof core.bookings)[number], c: typeof core) => ({
    lead: null,
    user: c.users.find((u) => u.id === b.user_id) ?? null,
    gate: null,
    room: null,
  }),
  villaMap: (villas: typeof core.villas) => new Map(villas.map((v) => [v.id, v])),
  profileMap: (profiles: typeof core.profiles) => new Map(profiles.map((p) => [p.user_id, p])),
  bookingMap: (bookings: typeof core.bookings) => new Map(bookings.map((b) => [b.id, b])),
  buildTimelineEvents: vi.fn(() => []),
}));

import { answerCollecta, decodeDraftAction, confirmDraft } from "@/data/collecta";

const principal = { id: "op-1", email: "alex@example.com", role: "admin" as const, leadId: null };
const ctx = (route: string) => ({ route, visibleEventIds: [] });

beforeEach(() => {
  settleCalls.length = 0;
  requestCalls.length = 0;
  applicationCalls.length = 0;
  for (const k of Object.keys(inserted)) delete inserted[k];
});

describe("money truthfulness", () => {
  it("quotes outstanding in euros as stored — no 100x rescale", async () => {
    const turn = await answerCollecta(ctx("/"), "what is outstanding?", principal);
    const body = turn.messages.at(-1)!.body;
    expect(body).toContain("€2,240");
    expect(body).not.toContain("224,000");
    expect(body).not.toMatch(/million/i);
  });
});

describe("page focus", () => {
  it("knows which record the operator is looking at", async () => {
    const turn = await answerCollecta(ctx("/dues/tx-due-bk-1"), "what am I looking at?", principal);
    expect(turn.messages.at(-1)!.body).toContain("Alex Sidarau");
    expect(turn.messages.at(-1)!.body).toContain("€2,240");
  });

  it("'can we comp it?' on a dues page drafts the comp for that exact stay", async () => {
    const turn = await answerCollecta(ctx("/dues/tx-due-bk-1"), "can we comp it?", principal);
    expect(turn.state).toBe("draft");
    expect(turn.draft?.title).toContain("€2,240");
    const action = decodeDraftAction(turn.draft!.id);
    expect(action).toMatchObject({ kind: "comp_due", bookingId: "bk-1" });
  });

  it("'approve it' on an access-request page drafts the decision", async () => {
    const turn = await answerCollecta(ctx("/requests/req-bk-bk-2"), "approve it", principal);
    expect(turn.state).toBe("draft");
    const action = decodeDraftAction(turn.draft!.id);
    expect(action).toMatchObject({ kind: "decide_request", bookingId: "bk-2", decision: "approve" });
  });

  it("'decline this one' drafts a decline", async () => {
    const turn = await answerCollecta(ctx("/requests/req-bk-bk-2"), "decline this one", principal);
    expect(turn.state).toBe("draft");
    const action = decodeDraftAction(turn.draft!.id);
    expect(action).toMatchObject({ kind: "decide_request", bookingId: "bk-2", decision: "decline" });
  });

  it("comps a stay named by person when no page is focused", async () => {
    const turn = await answerCollecta(ctx("/"), "comp Alex's July stay", principal);
    expect(turn.state).toBe("draft");
    const action = decodeDraftAction(turn.draft!.id);
    expect(action).toMatchObject({ kind: "comp_due", bookingId: "bk-1" });
  });

  it("asks which record when a comp has no target", async () => {
    const emptyCore = { ...core, bookings: [] };
    const live = await import("@/data/live-data");
    vi.mocked(live.fetchCoreData).mockResolvedValueOnce(emptyCore as never);
    const turn = await answerCollecta(ctx("/"), "comp it", principal);
    expect(turn.state).toBe("answer");
    expect(turn.messages.at(-1)!.body).toContain("Nothing is outstanding");
  });
});

describe("confirmed drafts execute through record-actions", () => {
  it("comp_due confirm calls settleContribution in comp mode", async () => {
    const turn = await answerCollecta(ctx("/dues/tx-due-bk-1"), "comp it", principal);
    const result = await confirmDraft(turn.draft!.id, principal);
    expect(result.ok).toBe(true);
    expect(settleCalls[0]).toMatchObject({ bookingId: "bk-1", mode: "comp" });
  });

  it("decide_request confirm calls decideAccessRequest", async () => {
    const turn = await answerCollecta(ctx("/requests/req-bk-bk-2"), "approve it", principal);
    const result = await confirmDraft(turn.draft!.id, principal);
    expect(result.ok).toBe(true);
    expect(requestCalls[0]).toMatchObject({ bookingId: "bk-2", decision: "approve" });
  });
});
