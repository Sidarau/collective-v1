import { describe, expect, it } from "vitest";
import { guardModeFromEnv } from "@/lib/page-params";
import { compareKey, decodeCursor, encodeCursor } from "@/data/timeline";
import {
  formatPeriod,
  initialsOf,
  mapApplicationToRequest,
  mapBookingToOutstanding,
  mapBookingToRequest,
  mapEventToExperience,
  mapFollowUpToEvent,
  mapOutstandingToEvent,
  mapPaymentToTransaction,
  toMinor,
} from "@/data/mappers";
import type {
  ApplicationRow,
  BookingRow,
  EventRow,
  FollowUpRow,
  PaymentRecordRow,
} from "@core/database.types";

/* ------------------------------------------------------------------ *
 * Guard env logic — the two deployment shapes
 * ------------------------------------------------------------------ */

describe("guard mode", () => {
  const env = (value?: string) => (value ? { MOBILE_AUTH_GUARD: value } : {}) as unknown as NodeJS.ProcessEnv;
  it("is enforced only by the explicit env value", () => {
    expect(guardModeFromEnv(env("enforced"))).toBe("enforced");
    expect(guardModeFromEnv(env())).toBe("preview");
    expect(guardModeFromEnv(env("1"))).toBe("preview");
    expect(guardModeFromEnv(env("true"))).toBe("preview");
  });
});

/* ------------------------------------------------------------------ *
 * Keyset cursors
 * ------------------------------------------------------------------ */

describe("keyset cursors", () => {
  it("round-trips a (sortAt, id) pair", () => {
    const cursor = encodeCursor("2026-07-26T12:00:00.000Z", "ev-123");
    expect(decodeCursor(cursor)).toEqual({ sortAt: "2026-07-26T12:00:00.000Z", id: "ev-123" });
  });

  it("rejects malformed cursors instead of throwing", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor(Buffer.from('"just a string"').toString("base64url"))).toBeNull();
  });

  it("orders by sortAt first, id as tiebreak", () => {
    const a = { sortAt: "2026-07-26T10:00:00Z", id: "b" };
    const b = { sortAt: "2026-07-26T10:00:00Z", id: "a" };
    const c = { sortAt: "2026-07-26T11:00:00Z", id: "a" };
    expect(compareKey(a, b)).toBeGreaterThan(0);
    expect(compareKey(b, a)).toBeLessThan(0);
    expect(compareKey(b, c)).toBeLessThan(0);
    expect(compareKey(a, a)).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Mapper invariants — money, precision, language
 * ------------------------------------------------------------------ */

const booking: BookingRow = {
  id: "bk-1",
  lead_id: "lead-1",
  user_id: null,
  room_id: "room-1",
  villa_id: "villa-1",
  check_in: "2026-08-01",
  check_out: "2026-08-05",
  guests: 2,
  guest_names: [],
  companion_name: null,
  event_id: null,
  status: "confirmed",
  total_price: 2400,
  currency: "EUR",
  special_requests: null,
  operator_notes: null,
  stripe_payment_intent_id: null,
  invoice_url: null,
  created_at: "2026-07-20T10:00:00Z",
  updated_at: "2026-07-20T10:00:00Z",
};

describe("money mapping", () => {
  it("converts whole units to minor units exactly", () => {
    expect(toMinor(2400)).toBe(240000);
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(null)).toBe(0);
  });

  it("maps a payment to a confirmed incoming transaction", () => {
    const payment: PaymentRecordRow = {
      id: "pay-1",
      booking_id: "bk-1",
      kind: "deposit",
      amount: 600,
      currency: "EUR",
      method: null,
      reference: null,
      note: null,
      recorded_by: null,
      received_at: "2026-07-21T09:00:00Z",
      created_at: "2026-07-21T09:00:00Z",
    };
    const tx = mapPaymentToTransaction(payment, booking, "Ana Martins");
    expect(tx.id).toBe("tx-pay-1");
    expect(tx.amountMinor).toBe(60000);
    expect(tx.direction).toBe("incoming");
    expect(tx.settlement).toBe("confirmed");
    expect(tx.displayPrecision).toBe("none"); // money never shows a clock
  });

  it("maps a refund to outgoing", () => {
    const refund: PaymentRecordRow = {
      ...({} as PaymentRecordRow),
      id: "pay-2",
      booking_id: "bk-1",
      kind: "refund",
      amount: 100,
      currency: "EUR",
      method: null,
      reference: null,
      note: null,
      recorded_by: null,
      received_at: "2026-07-22T09:00:00Z",
      created_at: "2026-07-22T09:00:00Z",
    };
    expect(mapPaymentToTransaction(refund, booking, null).direction).toBe("outgoing");
  });

  it("reports only the unsettled remainder as outstanding", () => {
    const tx = mapBookingToOutstanding(booking, 60000, "Ana Martins");
    expect(tx).not.toBeNull();
    expect(tx!.amountMinor).toBe(180000);
    expect(tx!.settlement).toBe("outstanding");
    expect(mapBookingToOutstanding(booking, 240000, null)).toBeNull();
    expect(mapBookingToOutstanding(booking, 999999, null)).toBeNull();
  });

  it("carries overdue outstanding money forward as critical", () => {
    const tx = mapBookingToOutstanding(booking, 0, "Ana Martins")!;
    const event = mapOutstandingToEvent(tx, "2026-08-10T00:00:00Z");
    expect(event.carriedFrom).toBe("2026-08-01");
    expect(event.priority).toBe("critical");
    expect(event.status).toBe("blocked");
    // Not overdue yet → no carry, softer priority.
    const future = mapOutstandingToEvent(tx, "2026-07-25T00:00:00Z");
    expect(future.carriedFrom).toBeUndefined();
    expect(future.priority).toBe("attention");
  });
});

describe("display precision truthfulness", () => {
  it("access requests never invent a clock", () => {
    const req = mapBookingToRequest(booking, {});
    expect(req.periodLabel).toBe("1–5 Aug");
  });

  it("overdue open follow-ups carry forward with no clock", () => {
    const fu: FollowUpRow = {
      id: "fu-1",
      owner_id: null,
      owner_email: null,
      entity_type: "lead",
      entity_id: "lead-1",
      title: "Call Ana about September",
      due_at: "2026-07-24T00:00:00Z",
      status: "open",
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    const event = mapFollowUpToEvent(fu, "2026-07-26T12:00:00Z");
    expect(event.carriedFrom).toBe("2026-07-24");
    expect(event.displayPrecision).toBe("none");
    expect(event.status).toBe("in_progress");
  });

  it("experiences are minute-precise — punctuality is meaningful", () => {
    const ev: EventRow = {
      id: "ev-1",
      villa_id: null,
      title: "Founders dinner",
      slug: "founders-dinner",
      description: null,
      event_type: "dinner",
      audience: "member",
      start_at: "2026-07-26T19:30:00Z",
      end_at: null,
      capacity: 12,
      hard_capacity: null,
      image: null,
      location_note: null,
      status: "draft",
      created_by: null,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    const x = mapEventToExperience(ev, "Terrace", 5);
    expect(x.displayPrecision).toBe("minute");
    expect(x.rsvpConfirmed).toBe(5);
    expect(x.rsvpCapacity).toBe(12);
    expect(x.published).toBe(false);
  });
});

describe("access-network language", () => {
  it("applications map to the request shape without hospitality copy", () => {
    const app: ApplicationRow = {
      id: "app-1",
      user_id: null,
      lead_id: null,
      email: "maya@example.org",
      first_name: "Maya",
      last_name: "Laurent",
      location: null,
      occupation: null,
      motivation: null,
      contribution: null,
      referred_by: "Ana",
      instagram: null,
      linkedin: null,
      links: {},
      preferred_window: "Late August",
      birthday: null,
      status: "submitted",
      screening_token: null,
      referral_link_id: null,
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: "2026-07-25T08:00:00Z",
      updated_at: "2026-07-25T08:00:00Z",
    };
    const req = mapApplicationToRequest(app);
    expect(req.kind).toBe("application");
    expect(req.id).toBe("req-app-app-1");
    expect(req.state.label).toBe("New");
    expect(JSON.stringify(req)).not.toMatch(/booking|guest|villa|stay|check-?in|occupancy/i);
  });

  it("booking rows never leak as 'booking' in presentation copy", () => {
    const req = mapBookingToRequest(booking, {});
    expect(req.kind).toBe("access_request");
    expect(JSON.stringify(req)).not.toMatch(/booking|guest|villa|stay|housekeeping|occupancy/i);
  });

  it("initials and period labels are stable", () => {
    expect(initialsOf("Ana Martins")).toBe("AM");
    expect(initialsOf("madonna")).toBe("MA");
    expect(initialsOf("")).toBe("—");
    expect(formatPeriod("2026-07-31", "2026-08-02")).toBe("31 Jul – 2 Aug");
  });
});
