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
  parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith("a") ? "b" : "a"}`;
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

test("Selene assistant can read/request but cannot approve or manage connections", () => {
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
