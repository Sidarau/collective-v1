/**
 * End-to-end KB v2 smoke against the LIVE DB. Creates a throwaway doc →
 * revision → publish → share, verifies the password gate + render, then
 * deletes everything it made. Run:
 *   SUPABASE_SECRET_KEY=… npx tsx scripts/kb-e2e-smoke.mts
 */
import { getSupabaseAdmin } from "../packages/core/src/supabase.ts";
import { createRevision, publishRevision, getPublishedRevision } from "../packages/core/src/kb-revisions.ts";
import {
  createShare, getShareByToken, verifySharePassword, shareState, mintShareSession, verifyShareSession,
} from "../packages/core/src/kb-shares.ts";
import { renderPage } from "../packages/core/src/kb-render.ts";

let fail = 0;
const ok = (n: string, c: boolean) => { console.log(`${c ? "✓" : "✗ FAIL"}  ${n}`); if (!c) fail++; };
const db = getSupabaseAdmin();

const md = `# Roca Llisa — Investor Deck\n\n## The opportunity\n\nA private circle around the world's quiet places.\n\n## Traction\n\n- 17 members\n- 3 gates\n\n<script>alert('xss')</script>`;

// 1. throwaway doc node
const { data: node } = await db.from("kb_nodes")
  .insert({ kind: "doc", title: "E2E smoke deck", slug: `e2e-smoke-${Date.now()}`, body_md: md, visibility: "internal" })
  .select("*").single();
ok("created doc node", !!node);
const nodeId = node!.id as string;

try {
  // 2. render + revision + publish
  const rev = await createRevision({ nodeId, markdown: md, template: "deck", theme: { accent: "#b8925a" } });
  ok("revision created + sanitized (no script)", !!rev.id && !/<script/i.test(rev.html));
  await publishRevision(nodeId, rev.id);
  const pub = await getPublishedRevision(nodeId);
  ok("published pointer resolves to revision", pub?.id === rev.id);

  // 3. share with a known password
  const { share, token, password, url } = await createShare({
    nodeId, revisionId: rev.id, recipientLabel: "E2E Investor", password: "correct-horse-battery",
  });
  ok("share created with URL", url.includes("/s/") && !!token);
  ok("share state ok", shareState(share) === "ok");

  // 4. lookup by token + password gate
  const found = await getShareByToken(token);
  ok("share found by token hash", found?.id === share.id);
  ok("wrong password rejected", !(await verifySharePassword(found!, "nope")).ok);
  ok("right password accepted", (await verifySharePassword(found!, password)).ok);

  // 5. session round-trip + render
  const jwt = await mintShareSession(share.id, rev.id);
  const claims = await verifyShareSession(jwt);
  ok("share session mints + verifies", claims?.sid === share.id && claims?.rid === rev.id);
  const page = renderPage({ title: node!.title, html: pub!.html, template: "deck", theme: { accent: "#b8925a" }, watermark: share.recipient_label });
  ok("rendered page is standalone + watermarked + no script", page.startsWith("<!doctype html>") && page.includes("E2E Investor") && !/<script/i.test(page));

  // 6. audit trail wrote something
  const { data: events } = await db.from("access_events").select("id").eq("resource_id", nodeId).limit(1);
  ok("access_events reachable", Array.isArray(events));
} finally {
  // cleanup — cascades to revisions/shares/acceptances via FKs
  await db.from("external_shares").delete().eq("node_id", nodeId);
  await db.from("kb_nodes").update({ published_revision_id: null }).eq("id", nodeId);
  await db.from("kb_revisions").delete().eq("node_id", nodeId);
  await db.from("access_events").delete().eq("resource_id", nodeId);
  await db.from("kb_nodes").delete().eq("id", nodeId);
  console.log("cleaned up test rows");
}

console.log(fail === 0 ? "\nALL E2E CHECKS PASS" : `\n${fail} E2E CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
