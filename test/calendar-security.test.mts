import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptCalendarSecret,
  encryptCalendarSecret,
  hashCalendarToken,
} from "../packages/core/src/calendar-crypto.ts";
import {
  calendarActionPreview,
  classifyCalendarActionRisk,
} from "../packages/core/src/calendar-risk.ts";
import { authorize, capabilitiesFor, type Principal } from "../packages/core/src/policy.ts";
import {
  signCalendarOAuthTargetValue,
  verifyCalendarOAuthTargetValue,
} from "../packages/core/src/calendar-oauth-state.ts";
import {
  DEFAULT_BOOKING_NOTICE_MINUTES,
  minimumBookableStartMs,
} from "../packages/core/src/scheduling-policy.ts";

const assistant: Principal = {
  kind: "agent",
  userId: "owner-id",
  entityId: null,
  agentScope: "assistant",
  via: "agent_token",
  tokenId: "token-id",
};

test("calendar secrets round-trip with AES-GCM and reject tampering", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const ciphertext = encryptCalendarSecret("refresh-token", key);
  assert.notEqual(ciphertext, "refresh-token");
  assert.equal(decryptCalendarSecret(ciphertext, key), "refresh-token");

  const parts = ciphertext.split(".");
  const tag = Buffer.from(parts[3], "base64url");
  tag[0] ^= 1;
  parts[3] = tag.toString("base64url");
  assert.throws(() => decryptCalendarSecret(parts.join("."), key));
});

test("webhook tokens are hashed deterministically without storing the token", () => {
  const first = hashCalendarToken("channel-token");
  assert.equal(first, hashCalendarToken("channel-token"));
  assert.notEqual(first, "channel-token");
  assert.equal(first.length, 64);
});

test("one-click OAuth handoff is signed and rejects tampering", () => {
  const signed = signCalendarOAuthTargetValue(
    { inviteId: "invite-id", adminId: "don-id" },
    "test-secret"
  );
  assert.deepEqual(verifyCalendarOAuthTargetValue(signed, "test-secret"), {
    inviteId: "invite-id",
    adminId: "don-id",
  });
  assert.equal(verifyCalendarOAuthTargetValue(`${signed}x`, "test-secret"), null);
  assert.equal(verifyCalendarOAuthTargetValue(signed, "wrong-secret"), null);
});

test("Collecta assistant can read/request but cannot self-approve or manage connections", () => {
  const caps = capabilitiesFor(assistant);
  assert.equal(caps.has("calendar.read"), true);
  assert.equal(caps.has("calendar.action.request"), true);
  assert.equal(caps.has("calendar.action.approve"), false);
  assert.equal(caps.has("calendar.connection.manage"), false);
  assert.equal(caps.has("ops.write"), false);
  assert.deepEqual(authorize(assistant, "calendar.action.approve"), {
    allow: false,
    reason: "human_only",
  });
});

test("attributable owner agents can operate CRM while shared system tokens stay bounded", () => {
  const ownerAgent: Principal = {
    ...assistant,
    agentScope: "owner",
  };
  const systemAgent: Principal = {
    ...ownerAgent,
    via: "system_token",
    tokenId: null,
  };
  assert.equal(capabilitiesFor(ownerAgent).has("ops.write"), true);
  assert.equal(capabilitiesFor(ownerAgent).has("kb.publish"), true);
  assert.equal(capabilitiesFor(systemAgent).has("ops.write"), false);
  assert.equal(capabilitiesFor(systemAgent).has("kb.publish"), false);
});

test("public screening slots require at least 24 hours notice by default", () => {
  assert.equal(DEFAULT_BOOKING_NOTICE_MINUTES, 1440);
  const now = new Date("2026-07-25T08:00:00.000Z");
  assert.equal(
    minimumBookableStartMs(now),
    Date.parse("2026-07-26T08:00:00.000Z")
  );
  assert.equal(
    minimumBookableStartMs(now, 30),
    Date.parse("2026-07-25T08:30:00.000Z")
  );
});

test("calendar risk model requires approval for changes, cancellations, or attendees", () => {
  const start = new Date(Date.now() + 86400_000).toISOString();
  const end = new Date(Date.now() + 90000_000).toISOString();
  assert.equal(
    classifyCalendarActionRisk("create", { summary: "Morning brief", startIso: start, endIso: end }),
    "low"
  );
  assert.equal(
    classifyCalendarActionRisk("create", {
      summary: "Vendor call",
      startIso: start,
      endIso: end,
      attendees: ["vendor@example.com"],
    }),
    "high"
  );
  assert.equal(classifyCalendarActionRisk("update", { startIso: start }), "high");
  assert.equal(classifyCalendarActionRisk("cancel", {}), "high");
});

test("calendar approval preview is concise and target-specific", () => {
  const preview = calendarActionPreview({
    sourceId: "source",
    operation: "cancel",
    eventId: "google-event",
    event: { summary: "Don / supplier" },
    idempotencyKey: "selene:cancel:1",
  });
  assert.match(preview, /Cancel/);
  assert.match(preview, /Don \/ supplier/);
  assert.match(preview, /google-event/);
});
