// One-time: point local env at the new `collective` Supabase project.
// Fetches API keys via the authenticated supabase CLI and rewrites .env.local,
// backing up the previous file to .env.local.old-db (needed by copy-db.mjs).
// Secret values are never printed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

const REF = process.env.NEW_DB_REF || "iudicmvyihswhvgmyvcf";
const URL = `https://${REF}.supabase.co`;
const ENV_PATH = ".env.local";
const BACKUP_PATH = ".env.local.old-db";

function getKeys() {
  const attempts = [
    ["projects", "api-keys", "--project-ref", REF, "-o", "json"],
    ["projects", "api-keys", "list", "--project-ref", REF, "-o", "json"],
  ];
  for (const args of attempts) {
    try {
      const out = execFileSync("supabase", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const parsed = JSON.parse(out);
      const rows = Array.isArray(parsed) ? parsed : parsed.data || [];
      const find = (n) => rows.find((k) => k.name === n)?.api_key;
      const anon = find("anon");
      const service = find("service_role");
      if (anon && service) return { anon, service };
    } catch {
      // try next CLI form
    }
  }
  throw new Error("Could not fetch API keys via supabase CLI");
}

const { anon, service } = getKeys();

if (!existsSync(BACKUP_PATH) && existsSync(ENV_PATH)) {
  copyFileSync(ENV_PATH, BACKUP_PATH);
  console.log(`backed up ${ENV_PATH} -> ${BACKUP_PATH}`);
}

const replacements = {
  NEXT_PUBLIC_SUPABASE_URL: URL,
  SUPABASE_URL: URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
};

let lines = existsSync(ENV_PATH)
  ? readFileSync(ENV_PATH, "utf8").split("\n")
  : [];
const seen = new Set();
lines = lines.map((line) => {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (m && m[1] in replacements) {
    seen.add(m[1]);
    return `${m[1]}=${replacements[m[1]]}`;
  }
  return line;
});
for (const [k, v] of Object.entries(replacements)) {
  if (!seen.has(k)) lines.push(`${k}=${v}`);
}
writeFileSync(ENV_PATH, lines.join("\n"));
console.log(
  `updated ${ENV_PATH}: ${Object.keys(replacements).join(", ")} -> project ${REF}`
);
