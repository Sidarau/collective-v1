// One-time data copy: old Supabase project -> new `collective` project.
// Reads OLD creds from .env.local.old-db and NEW creds from .env.local
// (run scripts/setup-new-db-env.mjs first). Preserves row UUIDs so FKs and
// Platform-native records and identifiers survive. Idempotent via upsert on id.
// Prints counts and user emails/roles only — never tokens or hashes.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

// Local .env.local.old-db can hold a stale key; prefer OLD_ENV (e.g. a
// `vercel env pull` file with the known-good prod values).
const oldEnv = loadEnv(process.env.OLD_ENV || ".env.local.old-db");
const newEnv = loadEnv(".env.local");

const oldDb = createClient(
  oldEnv.NEXT_PUBLIC_SUPABASE_URL,
  oldEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const newDb = createClient(
  newEnv.NEXT_PUBLIC_SUPABASE_URL,
  newEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

if (oldEnv.NEXT_PUBLIC_SUPABASE_URL === newEnv.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("old and new URLs are identical — env setup wrong, aborting");
}

// FK-safe order. Columns are copied verbatim (v2 columns have defaults).
const TABLES = [
  "villas",
  "rooms",
  "seasonal_pricing",
  "leads",
  "users",
  "magic_tokens",
  "bookings",
  "availability_blocks",
];

for (const table of TABLES) {
  const { data, error } = await oldDb.from(table).select("*");
  if (error) throw new Error(`read ${table}: ${error.message}`);
  if (!data || data.length === 0) {
    console.log(`${table}: 0 rows (skipped)`);
    continue;
  }
  const { error: writeError } = await newDb
    .from(table)
    .upsert(data, { onConflict: "id" });
  if (writeError) throw new Error(`write ${table}: ${writeError.message}`);
  console.log(`${table}: copied ${data.length} rows`);
}

const { data: users } = await newDb
  .from("users")
  .select("email, role, password_hash");
console.log(
  "users in new db:",
  (users || [])
    .map((u) => `${u.email} [${u.role}]${u.password_hash ? " +pw" : ""}`)
    .join(", ")
);
