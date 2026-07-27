import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { authorize, capabilitiesFor, type Principal } from "../packages/core/src/policy.ts";
import {
  approveStayRequest,
  publicStayRequestView,
  type AtomicStayApproval,
  type StayApprovalAudit,
  type StayApprovalDependencies,
} from "../packages/core/src/stay-requests.ts";

const ownerAgent: Principal = {
  kind: "agent",
  userId: "owner-id",
  entityId: null,
  agentScope: "owner",
  via: "agent_token",
  tokenId: "owner-token-id",
};

const approved: AtomicStayApproval = {
  booking_id: "booking-id",
  changed: true,
  from_status: "waitlisted",
  status: "approved",
  check_in: "2026-08-08",
  check_out: "2026-08-12",
  user_id: "user-id",
};

function dependencies(
  receipt: AtomicStayApproval | Error = approved
): {
  value: StayApprovalDependencies;
  audits: StayApprovalAudit[];
  notifications: string[];
} {
  const audits: StayApprovalAudit[] = [];
  const notifications: string[] = [];
  return {
    audits,
    notifications,
    value: {
      async approveAtomic() {
        if (receipt instanceof Error) throw receipt;
        return receipt;
      },
      async resolveRecipient() {
        return "member@example.com";
      },
      async notifyApproved({ email }) {
        notifications.push(email);
        return "logged";
      },
      async audit(event) {
        audits.push(event);
      },
    },
  };
}

test("only attributable owner agents receive stay approval capability", () => {
  const assistant: Principal = { ...ownerAgent, agentScope: "assistant" };
  const staff: Principal = { ...ownerAgent, agentScope: "staff" };
  const system: Principal = {
    ...ownerAgent,
    via: "system_token",
    tokenId: null,
  };

  assert.equal(capabilitiesFor(ownerAgent).has("stay.approve"), true);
  assert.equal(authorize(ownerAgent, "stay.approve").allow, true);
  assert.equal(capabilitiesFor(assistant).has("stay.approve"), false);
  assert.equal(capabilitiesFor(staff).has("stay.approve"), false);
  assert.equal(capabilitiesFor(system).has("stay.approve"), false);
});

test("approval defaults notifications off and emits one attributable receipt", async () => {
  const deps = dependencies();
  const result = await approveStayRequest(
    {
      id: "booking-id",
      expectedStatus: "waitlisted",
      actor: {
        id: "owner-id",
        email: "owner@example.com",
        label: "Collecta",
        via: "agent",
      },
    },
    deps.value
  );

  assert.equal(result.status, "approved");
  assert.equal(result.notification, "skipped");
  assert.deepEqual(deps.notifications, []);
  assert.equal(deps.audits.length, 1);
  assert.equal(deps.audits[0].action, "booking.approve");
  assert.equal(deps.audits[0].actor.label, "Collecta");
});

test("explicit notify queues exactly one existing approval message", async () => {
  const deps = dependencies();
  const result = await approveStayRequest(
    {
      id: "booking-id",
      expectedStatus: "waitlisted",
      notify: true,
      actor: {
        id: "owner-id",
        email: "owner@example.com",
        via: "agent",
      },
    },
    deps.value
  );

  assert.equal(result.notification, "logged");
  assert.deepEqual(deps.notifications, ["member@example.com"]);
  assert.equal(deps.audits[0].meta.notification, "logged");
});

test("already-approved retries are unchanged and never duplicate notifications", async () => {
  const deps = dependencies({
    ...approved,
    changed: false,
    from_status: "approved",
  });
  const result = await approveStayRequest(
    {
      id: "booking-id",
      expectedStatus: "waitlisted",
      notify: true,
      actor: {
        id: "owner-id",
        email: "owner@example.com",
        via: "agent",
      },
    },
    deps.value
  );

  assert.equal(result.changed, false);
  assert.equal(result.notification, "skipped");
  assert.deepEqual(deps.notifications, []);
  assert.equal(deps.audits[0].action, "booking.approve_unchanged");
});

test("blocked approvals remain unchanged and leave a bounded audit reason", async () => {
  const deps = dependencies(new Error("Conflict: room already committed"));
  await assert.rejects(
    approveStayRequest(
      {
        id: "booking-id",
        expectedStatus: "requested",
        actor: {
          id: "owner-id",
          email: "owner@example.com",
          via: "agent",
        },
      },
      deps.value
    ),
    /Conflict/
  );
  assert.equal(deps.audits.length, 1);
  assert.equal(deps.audits[0].action, "booking.approve_blocked");
  assert.equal(
    deps.audits[0].meta.reason,
    "Conflict: room already committed"
  );
});

test("stay search projection cannot leak contact details or operator notes", () => {
  const view = publicStayRequestView({
    id: "booking-id",
    memberName: "Michael Weil",
    checkIn: "2026-08-08",
    checkOut: "2026-08-12",
    status: "waitlisted",
    roomName: "Garden Suite",
    gateName: "Roca Llisa",
    email: "private@example.com",
    phone: "+0000000000",
    operatorNotes: "private note",
  });
  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /private@example/);
  assert.doesNotMatch(serialized, /\+000/);
  assert.doesNotMatch(serialized, /private note/);
  assert.deepEqual(Object.keys(view).sort(), [
    "checkIn",
    "checkOut",
    "gateName",
    "id",
    "memberName",
    "roomName",
    "status",
  ]);
});

test("database approval is serialized, conflict-aware, and service-role only", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260727221121_atomic_stay_request_approval.sql",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /availability_blocks/);
  assert.match(migration, /closure_periods/);
  assert.match(migration, /other\.status in \('approved', 'deposit_paid', 'paid', 'confirmed'\)/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke execute[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});
