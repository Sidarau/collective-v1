import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Composer write actions — validation, link resolution, and the writes
 * themselves. Supabase is mocked at the client boundary; the assertions are
 * about WHICH table gets WHAT row, plus the audit trail.
 */

const inserted: Record<string, unknown[]> = {};
const auditRows: Record<string, unknown>[] = [];

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
vi.mock("@core/supabase", () => {
  const rows: Record<string, Record<string, unknown> | null> = {
    villas: { id: "villa-1" },
    users: { id: "user-9" },
    staff_applications: { id: "staff-7" },
    events: { id: "evt-5", villa_id: "villa-1" },
    rooms: { id: "room-1", villa_id: "villa-1" },
    leads: null,
    closure_periods: null,
    bookings: null,
  };
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    let lastEqValue: unknown = null;
    const self = () => chain;
    chain.select = self; chain.neq = self; chain.in = self;
    chain.lt = self; chain.gt = self; chain.gte = self; chain.lte = self;
    chain.order = self; chain.limit = self; chain.or = self;
    chain.is = self;
    chain.eq = (_col: string, value: unknown) => {
      lastEqValue = value;
      return chain;
    };
    // A row only "exists" when the last eq'd value appears in the fixture
    // row's fields — covers id lookups AND foreign-key lookups (villa_id).
    let terminal = false;
    chain.maybeSingle = async () => {
      terminal = true;
      const row = rows[table];
      if (!row) return { data: null, error: null };
      if (lastEqValue !== null && !Object.values(row).includes(lastEqValue)) {
        return { data: null, error: null };
      }
      return { data: row, error: null };
    };
    chain.then = (
      resolve: (v: { data: unknown; error: null }) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      if (terminal) return Promise.resolve({ data: null as unknown, error: null }).then(resolve, reject);
      return Promise.resolve({ data: [] as unknown, error: null }).then(resolve, reject);
    };
    chain.single = async () => {
      terminal = true;
      return {
        data: table === "bookings" ? { id: "bk-new" } : table === "events" ? { id: "evt-new" } : rows[table],
        error: null,
      };
    };
    chain.insert = (payload: Record<string, unknown> | Record<string, unknown>[]) => {
      inserted[table] = [...(inserted[table] ?? []), ...(Array.isArray(payload) ? payload : [payload])];
      terminal = true; // insert chains end in .select().single() or bare await
      return chain;
    };
    chain.update = self; chain.delete = self;
    return chain;
  };
  return { getSupabaseAdmin: () => ({ from: builder }) };
});

import { createFromComposer } from "@/data/composer-actions";

beforeEach(() => {
  for (const k of Object.keys(inserted)) delete inserted[k];
  auditRows.length = 0;
});

const base = { title: "Test item", date: "2026-08-01" };

describe("composer validation", () => {
  it("rejects an empty title", async () => {
    const r = await createFromComposer({ kind: "note", title: "  ", date: "2026-08-01", link: { id: "person-user-9", kind: "person" } });
    expect(r.ok).toBe(false);
    expect(inserted.admin_notes).toBeUndefined();
  });

  it("rejects a missing link", async () => {
    const r = await createFromComposer({ kind: "note", ...base });
    expect(r).toEqual({ ok: false, message: "Choose what this attaches to first." });
  });

  it("rejects an unknown link target", async () => {
    const r = await createFromComposer({ kind: "note", ...base, link: { id: "person-ghost", kind: "person" } });
    expect(r.ok).toBe(false);
  });

  it("rejects a malformed date on day-scoped kinds", async () => {
    const r = await createFromComposer({ kind: "due", ...base, date: "Aug 1", amount: "50", link: { id: "person-user-9", kind: "person" } });
    expect(r.ok).toBe(false);
    expect(inserted.follow_ups).toBeUndefined();
  });
});

describe("note", () => {
  it("writes an admin_note against the linked entity + audit row", async () => {
    const r = await createFromComposer({
      kind: "note", ...base, note: "Left a message",
      link: { id: "person-user-9", kind: "person" },
    });
    expect(r.ok).toBe(true);
    expect(inserted.admin_notes?.[0]).toMatchObject({
      author_id: "op-1", entity_type: "user", entity_id: "user-9",
    });
    expect(auditRows[0]).toMatchObject({ action: "mobile.composer.note", entityType: "user" });
  });
});

describe("request (follow-up)", () => {
  it("writes a follow_up owned by the operator", async () => {
    const r = await createFromComposer({
      kind: "request", ...base,
      link: { id: "gate-villa-1", kind: "gate" },
    });
    expect(r.ok).toBe(true);
    expect(inserted.follow_ups?.[0]).toMatchObject({
      owner_id: "op-1", entity_type: "villa", entity_id: "villa-1", due_at: "2026-08-01",
    });
    expect(auditRows[0]).toMatchObject({ action: "mobile.composer.follow_up" });
  });
});

describe("due", () => {
  it("requires an amount and keeps cents math exact", async () => {
    const noAmount = await createFromComposer({
      kind: "due", ...base, link: { id: "person-user-9", kind: "person" },
    });
    expect(noAmount).toEqual({ ok: false, message: "Add an amount first." });

    const r = await createFromComposer({
      kind: "due", ...base, amount: "120.50",
      link: { id: "person-user-9", kind: "person" },
    });
    expect(r.ok).toBe(true);
    const dueTitle = (inserted.follow_ups?.[0] as { title?: string } | undefined)?.title;
    expect(dueTitle).toMatch(/^€120\.50 — Test item/);
    expect(auditRows[0]?.summary).toMatch(/^€120\.50/);
  });

  it("refuses dues linked to a Space", async () => {
    const r = await createFromComposer({
      kind: "due", ...base, amount: "10",
      link: { id: "space-villa-1", kind: "space" },
    });
    expect(r).toEqual({ ok: false, message: "Dues attach to a person or a partner." });
  });
});

describe("access period", () => {
  it("creates a confirmed booking with the conflict window checked", async () => {
    const r = await createFromComposer({
      kind: "access", ...base, people: 3, note: "Arriving late",
      link: { id: "space-villa-1", kind: "space" },
    });
    expect(r.ok, (r as { message?: string }).message).toBe(true);
    expect(inserted.bookings?.[0]).toMatchObject({
      room_id: "room-1", villa_id: "villa-1",
      check_in: "2026-08-01", check_out: "2026-08-02",
      guests: 3, status: "confirmed",
    });
    expect(auditRows[0]).toMatchObject({ action: "mobile.composer.access", entityType: "booking", entityId: "bk-new" });
  });

  it("refuses access linked to a person", async () => {
    const r = await createFromComposer({
      kind: "access", ...base, link: { id: "person-user-9", kind: "person" },
    });
    expect(r).toEqual({ ok: false, message: "Access periods attach to a Space." });
  });
});

describe("space reset / upkeep", () => {
  it("closes the Space for the day and leaves a note", async () => {
    const r = await createFromComposer({
      kind: "space_reset", ...base, note: "Deep clean",
      link: { id: "space-villa-1", kind: "space" },
    });
    expect(r.ok).toBe(true);
    expect(inserted.closure_periods?.[0]).toMatchObject({
      villa_id: "villa-1", starts_on: "2026-08-01", ends_on: "2026-08-01",
    });
    const noteBody = (inserted.admin_notes?.[0] as { body?: string } | undefined)?.body;
    expect(noteBody).toMatch(/^Upkeep 2026-08-01/);
  });
});

describe("experience", () => {
  it("always lands as a member-audience DRAFT — never published", async () => {
    const r = await createFromComposer({
      kind: "experience", ...base, people: 12,
      link: { id: "space-villa-1", kind: "space" },
    });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/draft/i);
    expect(inserted.events?.[0]).toMatchObject({
      title: "Test item", status: "draft", audience: "member",
      capacity: 12, villa_id: "villa-1", created_by: "op-1",
    });
    expect(auditRows[0]).toMatchObject({ action: "mobile.composer.experience", entityId: "evt-new" });
  });
});
