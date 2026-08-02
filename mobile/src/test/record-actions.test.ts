import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Record decisions — the write layer behind detail-screen buttons and
 * Collecta's confirmed drafts. Supabase is mocked at the client boundary;
 * assertions are about WHICH table gets WHAT write, plus the audit trail
 * and the conflict checks on approve.
 */

const inserted: Record<string, unknown[]> = {};
const updated: Record<string, unknown[]> = {};
const auditRows: Record<string, unknown>[] = [];

const fixtures = vi.hoisted(() => ({
  roomAvailable: true,
  userExists: false,
  payments: [] as Record<string, unknown>[],
  BOOKING: {
    id: "bk-1",
    room_id: "room-1",
    villa_id: "villa-1",
    check_in: "2026-07-08",
    check_out: "2026-07-16",
    status: "requested",
    operator_notes: null,
    currency: "EUR",
    total_price: 224000,
  },
  APPLICATION: {
    id: "app-1",
    email: "new.person@example.com",
    first_name: "New",
    last_name: "Person",
    status: "submitted",
    user_id: null,
    lead_id: null,
    occupation: null,
    location: null,
    motivation: null,
    contribution: null,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/guard", () => ({
  getOperatorPrincipal: vi.fn(async () => ({
    id: "op-1",
    email: "alex@example.com",
    role: "admin",
    leadId: null,
  })),
}));
vi.mock("@core/audit", () => ({
  writeAudit: vi.fn(async (row: Record<string, unknown>) => {
    auditRows.push(row);
  }),
}));
vi.mock("@core/invites", () => ({ mintMagicLink: vi.fn(async () => "https://example.com/magic") }));
vi.mock("@core/email", () => ({ sendMagicLinkEmail: vi.fn(async () => ({ status: "logged" })) }));
vi.mock("@core/config", () => ({ config: { baseUrl: "https://example.com", brandName: "Collective" } }));
vi.mock("@core/availability", () => ({
  BLOCKING_STATUSES: ["requested", "approved", "deposit_paid", "paid", "confirmed"],
  fetchVillaClosures: vi.fn(async () => []),
  isClosedFor: vi.fn(() => false),
  isRoomAvailable: vi.fn(() => fixtures.roomAvailable),
}));

vi.mock("@core/supabase", () => {
  const singleRows: Record<string, Record<string, unknown> | null> = {
    bookings: fixtures.BOOKING,
    applications: fixtures.APPLICATION,
    users: { id: "user-9" },
    profiles: null,
    leads: null,
    villas: { id: "villa-1", name: "Roca Llisa" },
    follow_ups: {
      id: "fu-1",
      title: "Call the plumber",
      status: "open",
      entity_type: "villa",
      entity_id: "villa-1",
    },
    payment_records: { id: "pay-1", booking_id: "bk-1" },
  };
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self; chain.neq = self; chain.in = self;
    chain.lt = self; chain.gt = self; chain.gte = self; chain.lte = self;
    chain.order = self; chain.limit = self; chain.or = self; chain.is = self;
    chain.eq = self; chain.ilike = self;
    let terminal = false;
    chain.maybeSingle = async () => {
      terminal = true;
      const row = singleRows[table] ?? null;
      // Simulate the approve flow: the application starts without a user,
      // and no existing user matches the applicant's email.
      if (table === "users" && (row as { id: string } | null)?.id === "user-9" && !fixtures.userExists) {
        return { data: null, error: null };
      }
      return { data: row, error: null };
    };
    chain.single = async () => {
      terminal = true;
      if (table === "users") return { data: { id: "user-new" }, error: null };
      return { data: singleRows[table] ?? null, error: null };
    };
    chain.then = (
      resolve: (v: { data: unknown; error: null }) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      if (terminal) return Promise.resolve({ data: null as unknown, error: null }).then(resolve, reject);
      if (table === "payment_records") {
        return Promise.resolve({ data: fixtures.payments as unknown, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: [] as unknown, error: null }).then(resolve, reject);
    };
    chain.insert = (payload: Record<string, unknown> | Record<string, unknown>[]) => {
      inserted[table] = [...(inserted[table] ?? []), ...(Array.isArray(payload) ? payload : [payload])];
      terminal = true;
      return chain;
    };
    chain.update = (payload: Record<string, unknown>) => {
      updated[table] = [...(updated[table] ?? []), payload];
      return chain;
    };
    chain.delete = self;
    return chain;
  };
  return { getSupabaseAdmin: () => ({ from: builder }) };
});

import {
  addEntityNote,
  completeFollowUp,
  decideAccessRequest,
  decideApplication,
  getAuditTrail,
  resolveEntityRef,
  settleContribution,
} from "@/data/record-actions";

beforeEach(() => {
  for (const k of Object.keys(inserted)) delete inserted[k];
  for (const k of Object.keys(updated)) delete updated[k];
  auditRows.length = 0;
  fixtures.roomAvailable = true;
  fixtures.payments = [];
  fixtures.userExists = false;
  fixtures.BOOKING.status = "requested";
  fixtures.APPLICATION.status = "submitted";
});

describe("decideAccessRequest", () => {
  it("approves a requested window with audit", async () => {
    const r = await decideAccessRequest({ bookingId: "bk-1", decision: "approve" });
    expect(r.ok).toBe(true);
    expect(updated.bookings?.[0]).toMatchObject({ status: "approved" });
    expect(auditRows[0]).toMatchObject({ action: "booking.approve", entityType: "booking", entityId: "bk-1" });
  });

  it("blocks approve when the room is committed", async () => {
    fixtures.roomAvailable = false;
    const r = await decideAccessRequest({ bookingId: "bk-1", decision: "approve" });
    expect(r.ok).toBe(false);
    expect(updated.bookings).toBeUndefined();
    expect(auditRows.length).toBe(0);
  });

  it("refuses a decision from the wrong state", async () => {
    fixtures.BOOKING.status = "confirmed";
    const r = await decideAccessRequest({ bookingId: "bk-1", decision: "approve" });
    expect(r.ok).toBe(false);
    expect(updated.bookings).toBeUndefined();
  });

  it("declines a requested window", async () => {
    const r = await decideAccessRequest({ bookingId: "bk-1", decision: "decline" });
    expect(r.ok).toBe(true);
    expect(updated.bookings?.[0]).toMatchObject({ status: "cancelled" });
    expect(auditRows[0]).toMatchObject({ action: "booking.reject" });
  });

  it("confirms an approved window (the access handoff)", async () => {
    fixtures.BOOKING.status = "approved";
    const r = await decideAccessRequest({ bookingId: "bk-1", decision: "confirm" });
    expect(r.ok).toBe(true);
    expect(updated.bookings?.[0]).toMatchObject({ status: "confirmed" });
    expect(auditRows[0]).toMatchObject({ action: "booking.confirm" });
  });
});

describe("decideApplication", () => {
  it("denies a submitted application with audit", async () => {
    const r = await decideApplication({ applicationId: "app-1", decision: "deny" });
    expect(r.ok).toBe(true);
    expect(updated.applications?.[0]).toMatchObject({ status: "rejected", reviewed_by: "op-1" });
    expect(auditRows[0]).toMatchObject({ action: "application.rejected", entityType: "application" });
  });

  it("approves: creates the member, seeds profile, updates the application, audits", async () => {
    const r = await decideApplication({ applicationId: "app-1", decision: "approve" });
    expect(r.ok).toBe(true);
    expect(inserted.users?.[0]).toMatchObject({ email: "new.person@example.com", role: "member" });
    expect(inserted.profiles?.[0]).toMatchObject({ first_name: "New", onboarding_completed: false });
    expect(updated.applications?.[0]).toMatchObject({ status: "approved", user_id: "user-new" });
    expect(auditRows[0]).toMatchObject({ action: "application.approve" });
  });

  it("refuses to decide an already-approved application", async () => {
    fixtures.APPLICATION.status = "approved";
    const r = await decideApplication({ applicationId: "app-1", decision: "approve" });
    expect(r.ok).toBe(false);
    expect(updated.applications).toBeUndefined();
  });
});

describe("settleContribution", () => {
  it("records the full outstanding amount as received (minor units, no rescale)", async () => {
    const r = await settleContribution({ bookingId: "bk-1", mode: "received" });
    expect(r.ok).toBe(true);
    expect(inserted.payment_records?.[0]).toMatchObject({
      booking_id: "bk-1",
      kind: "balance",
      amount: 224000,
      method: "manual",
    });
    expect(r.message).toContain("€2,240");
    expect(auditRows[0]).toMatchObject({ action: "booking.payment_received" });
  });

  it("comps the outstanding remainder after a partial payment", async () => {
    fixtures.payments = [{ id: "pay-0", kind: "deposit", amount: 100000 }];
    const r = await settleContribution({ bookingId: "bk-1", mode: "comp", note: "test stay" });
    expect(r.ok).toBe(true);
    expect(inserted.payment_records?.[0]).toMatchObject({
      kind: "other",
      amount: 124000,
      method: "comp",
    });
    expect((inserted.payment_records?.[0] as { note: string }).note).toContain("Comped");
    expect(auditRows[0]).toMatchObject({ action: "booking.comp" });
  });

  it("is a no-op when nothing is outstanding", async () => {
    fixtures.payments = [{ id: "pay-0", kind: "balance", amount: 224000 }];
    const r = await settleContribution({ bookingId: "bk-1", mode: "received" });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("Nothing is outstanding");
    expect(inserted.payment_records).toBeUndefined();
  });
});

describe("notes, follow-ups, refs", () => {
  it("adds a note against a resolved person ref", async () => {
    fixtures.userExists = true;
    const r = await addEntityNote({ ref: "person-user-9", body: "Called, left a message" });
    expect(r.ok).toBe(true);
    expect(inserted.admin_notes?.[0]).toMatchObject({ entity_type: "user", entity_id: "user-9" });
    expect(auditRows[0]).toMatchObject({ action: "mobile.note.add" });
  });

  it("resolves a payment ref to its booking", async () => {
    const resolved = await resolveEntityRef("tx-pay-1");
    expect(resolved).toEqual({ entityType: "booking", entityId: "bk-1" });
  });

  it("rejects a malformed ref", async () => {
    const resolved = await resolveEntityRef("nonsense");
    expect("error" in resolved).toBe(true);
  });

  it("completes an open follow-up with audit", async () => {
    const r = await completeFollowUp({ followUpId: "fu-1" });
    expect(r.ok).toBe(true);
    expect(updated.follow_ups?.[0]).toMatchObject({ status: "done" });
    expect(auditRows[0]).toMatchObject({ action: "follow_up.complete" });
  });

  it("reads the audit trail for a record", async () => {
    const trail = await getAuditTrail({ ref: "req-bk-bk-1" });
    expect(trail.ok).toBe(true);
    expect(Array.isArray(trail.entries)).toBe(true);
  });
});
