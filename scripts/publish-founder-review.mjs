import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const manifestPath = path.join(
  repoRoot,
  "admin/src/content/founder-review-manifest.json"
);

const sourceFlag = process.argv.indexOf("--source");
const dryRun = process.argv.includes("--dry-run");
if (sourceFlag === -1 || !process.argv[sourceFlag + 1]) {
  throw new Error("Usage: node scripts/publish-founder-review.mjs --source <prepared-review-directory>");
}

const sourceRoot = path.resolve(process.argv[sourceFlag + 1]);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase server configuration is unavailable");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertHash(buffer, expected, label) {
  const actual = sha256(buffer);
  if (actual !== expected) {
    throw new Error(`${label} changed: expected ${expected}, received ${actual}`);
  }
}

function transformDeck(source) {
  const gateStart = source.indexOf('  <div id="gate"');
  const mainStart = source.indexOf("  <main>", gateStart);
  const scriptStart = source.lastIndexOf("  <script>");
  const scriptEnd = source.indexOf("  </script>", scriptStart);
  if (gateStart < 0 || mainStart < 0 || scriptStart < 0 || scriptEnd < 0) {
    throw new Error("Founder review source no longer matches the authenticated-deck transform");
  }

  let html = source.slice(0, gateStart) + source.slice(mainStart, scriptStart);
  html += `  <script>
  (function(){
    function startObservers(){var els=document.querySelectorAll(".io");if(!("IntersectionObserver" in window)){els.forEach(function(el){el.classList.add("in")});return}var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{threshold:.08,rootMargin:"0px 0px -6%"});els.forEach(function(el){io.observe(el)})}
    startObservers();
    document.getElementById("copy-feedback").addEventListener("click",function(){
      var text="OPEN COLLECTIVE FOUNDER REVIEW\\n1. KEEP — what is directionally right?\\n2. CHANGE — what is wrong, missing, or too optimistic?\\n3. CHALLENGE — which number or assumption would you refuse to defend?\\n4. DECIDE — what needs a founder decision this week?\\n\\nPlease also answer: Which offer will you personally sell in the next 30 days, and to whom?";
      var status=document.getElementById("copy-status");
      if(navigator.clipboard){navigator.clipboard.writeText(text).then(function(){status.textContent="Feedback prompt copied — paste it into the founders chat."}).catch(function(){status.textContent="Copy unavailable. Use the four prompts above."})}else{status.textContent="Copy unavailable. Use the four prompts above."}
    });
  })();
  </script>\n`;
  html += source.slice(scriptEnd + "  </script>".length);

  return html
    .replace("<body>", '<body class="unlocked">')
    .replaceAll('url("assets/', 'url("/founder-review/files/')
    .replaceAll('src="assets/', 'src="/founder-review/files/')
    .replaceAll('href="files/', 'href="/founder-review/files/')
    .replaceAll('target="_blank">', 'target="_blank" rel="noopener">')
    .replace(
      '<span class="chip chip-danger">Not for external circulation</span>',
      '<span class="chip chip-danger">Founder accounts only</span>'
    );
}

function validateTransformedDeck(html) {
  const required = [
    '<body class="unlocked">',
    'href="/founder-review/files/open-collective-business-plan-model.xlsx"',
    'src="/founder-review/files/maison-exterior.jpg"',
    "Founder accounts only",
  ];
  const forbidden = [
    'id="gate"',
    "oc_founder_review_2026_unlocked",
    "a86296418dfbfd118451c3a00919f414facb362d8a05a9bb5becb5d836438801",
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`Authenticated deck is missing: ${marker}`);
  }
  for (const marker of forbidden) {
    if (html.includes(marker)) throw new Error(`Authenticated deck still contains: ${marker}`);
  }
}

async function ensurePrivateBucket() {
  const { data, error } = await supabase.storage.getBucket(manifest.bucket);
  const options = {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "text/html",
      "text/markdown",
    ],
  };

  if (!data) {
    const created = await supabase.storage.createBucket(manifest.bucket, options);
    if (created.error) throw created.error;
    console.log(`created private bucket: ${manifest.bucket}`);
    return;
  }

  if (error && !data) throw error;
  const updated = await supabase.storage.updateBucket(manifest.bucket, options);
  if (updated.error) throw updated.error;
  console.log(`verified private bucket: ${manifest.bucket}`);
}

async function upload(storagePath, content, contentType, label) {
  const { error } = await supabase.storage.from(manifest.bucket).upload(storagePath, content, {
    cacheControl: "0",
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`${label}: ${error.message}`);

  const { data: info, error: infoError } = await supabase.storage
    .from(manifest.bucket)
    .info(storagePath);
  if (infoError || !info || Number(info.size) !== content.length) {
    throw new Error(`${label}: uploaded object size could not be verified`);
  }
  console.log(`uploaded ${label} (${content.length} bytes)`);
}

if (!dryRun) await ensurePrivateBucket();

const deckSource = await readFile(path.join(sourceRoot, manifest.deck.source));
assertHash(deckSource, manifest.deck.sourceSha256, manifest.deck.source);
const deck = Buffer.from(transformDeck(deckSource.toString("utf8")), "utf8");
validateTransformedDeck(deck.toString("utf8"));
if (dryRun) console.log(`validated authenticated deck (${deck.length} bytes)`);
else await upload(manifest.deck.storagePath, deck, "text/html", "authenticated deck");

for (const [filename, file] of Object.entries(manifest.files)) {
  const content = await readFile(path.join(sourceRoot, file.source));
  assertHash(content, file.sha256, file.source);
  if (dryRun) console.log(`validated ${filename} (${content.length} bytes)`);
  else await upload(file.storagePath, content, file.contentType, filename);
}

console.log(
  dryRun
    ? `founder review ${manifest.version} passed local package validation`
    : `founder review ${manifest.version} published to private storage`
);
