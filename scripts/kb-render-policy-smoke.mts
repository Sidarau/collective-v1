import { renderRevision, verifyRevisionHash, renderPage } from "../packages/core/src/kb-render.ts";
import { authorize, capabilitiesFor, audienceFor, type Principal } from "../packages/core/src/policy.ts";

let fail = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "✓" : "✗ FAIL"}  ${name}`); if (!cond) fail++; };

// --- renderer / sanitizer ---
const md = `# Deck\n\n<script>alert(1)</script>\n\n![x](https://ex.com/a.png "t")\n\n<img src=x onerror=alert(2)>\n\n[ext](https://evil.example) and **bold**.\n\n| a | b |\n|---|---|\n| 1 | 2 |`;
const r = renderRevision(md, "deck");
ok("no <script> survives", !/<script/i.test(r.html));
ok("no onerror survives", !/onerror/i.test(r.html));
ok("external link gets rel=noopener", /rel="noopener noreferrer nofollow"/.test(r.html) && /target="_blank"/.test(r.html));
ok("bold + table render", /<strong>bold<\/strong>/.test(r.html) && /<table>/.test(r.html));
ok("content hash is 64-hex", /^[0-9a-f]{64}$/.test(r.contentHash));
ok("hash deterministic", renderRevision(md, "deck").contentHash === r.contentHash);
ok("hash changes with template", renderRevision(md, "article").contentHash !== r.contentHash);
ok("verifyRevisionHash true on match", verifyRevisionHash(md, "deck", r.contentHash));
ok("verifyRevisionHash false on tamper", !verifyRevisionHash(md + "x", "deck", r.contentHash));

const page = renderPage({ title: "Q3 <deck>", html: r.html, template: "deck", theme: { accent: "#b8925a" }, eyebrow: "Confidential", watermark: "don@x.com" });
ok("page is a full document", page.startsWith("<!doctype html>"));
ok("page escapes title", page.includes("Q3 &lt;deck&gt;") && !page.includes("<deck>"));
ok("page is noindex", /noindex, nofollow/.test(page));
ok("watermark present", page.includes("don@x.com"));
ok("no external script/style/font/iframe resource loads", !/(<script|<iframe|<link[^>]+stylesheet|@import|url\(\s*https?:)/i.test(page));

// --- policy ---
const P = (o: Partial<Principal>): Principal => ({ kind: "public", userId: null, entityId: null, via: "anonymous", tokenId: null, ...o });
const ownerH = P({ kind: "owner", userId: "u1", via: "session" });
const operator = P({ kind: "operator", userId: "u2", via: "session" });
const agentOwner = P({ kind: "agent", agentScope: "owner", via: "agent_token", tokenId: "t1" });
const agentStaff = P({ kind: "agent", agentScope: "staff", via: "agent_token", tokenId: "t2" });
const agentMember = P({ kind: "agent", agentScope: "member", via: "agent_token", tokenId: "t3" });
const member = P({ kind: "member", userId: "m1", via: "session" });
const ext = P({ kind: "external_share", entityId: "s1", via: "share_session" });
const anon = P({});

ok("owner may publish (granted tree)", authorize(ownerH, "kb.publish", { treeGranted: true }).allow);
ok("operator may publish (granted tree)", authorize(operator, "kb.publish", { treeGranted: true }).allow);
ok("agent(owner) MAY publish (granted tree)", authorize(agentOwner, "kb.publish", { treeGranted: true }).allow);
ok("agent(owner) CANNOT share externally", authorize(agentOwner, "kb.share", { treeGranted: true }).reason === "human_only");
ok("agent(owner) CANNOT grant", authorize(agentOwner, "kb.grant", { treeGranted: true }).reason === "human_only");
ok("agent(owner) MAY draft on granted tree", authorize(agentOwner, "kb.draft", { treeGranted: true }).allow);
ok("agent(staff) denied on operator-only tree", authorize(agentStaff, "kb.draft", { treeGranted: false }).reason === "tree_denied");
ok("agent(staff) has NO publish cap", !capabilitiesFor(agentStaff).has("kb.publish"));
ok("agent(staff) publish denied (no_capability)", authorize(agentStaff, "kb.publish", { treeGranted: true }).reason === "no_capability");
ok("agent(member) may view member tree", authorize(agentMember, "kb.view", { treeGranted: true }).allow);
ok("agent(member) audience is member", audienceFor(agentMember) === "member");
ok("agent(member) CANNOT draft", authorize(agentMember, "kb.draft", { treeGranted: true }).reason === "no_capability");
ok("agent(member) CANNOT publish", !capabilitiesFor(agentMember).has("kb.publish"));
ok("member may view granted tree", authorize(member, "kb.view", { treeGranted: true }).allow);
ok("member denied ungranted tree", authorize(member, "kb.view", { treeGranted: false }).reason === "tree_denied");
ok("member cannot draft", authorize(member, "kb.draft", { treeGranted: true }).reason === "no_capability");
ok("external view matches its share", authorize(ext, "kb.view", { shareMatches: true }).allow);
ok("external denied other share", authorize(ext, "kb.view", { shareMatches: false }).reason === "share_mismatch");
ok("external cannot draft", !authorize(ext, "kb.draft").allow);
ok("public denied kb.view", authorize(anon, "kb.view", { treeGranted: true }).reason === "no_capability");
ok("undecided (no facts) fails closed", authorize(operator, "kb.view", {}).reason === "undecided");
ok("audience mapping", audienceFor(agentStaff) === "staff" && audienceFor(operator) === "operator" && audienceFor(ext) === null);

console.log(fail === 0 ? "\nALL PURE-CORE CHECKS PASS" : `\n${fail} CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
