// Apply a SQL file to the production Supabase Postgres via the supavisor
// pooler (IPv4). Usage: SUPABASE_DB_PASSWORD=... node scripts/run-migration.mjs <file.sql>
// The project region isn't recorded anywhere local, so candidate regional
// pooler hosts are tried until the tenant authenticates. Secrets never print.
import { readFileSync } from "node:fs";
import pg from "pg";

const REF = "evviegqieqdmlxixwwxt";
const password = process.env.SUPABASE_DB_PASSWORD;
const file = process.argv[2];
if (!password) throw new Error("SUPABASE_DB_PASSWORD not in env");
if (!file) throw new Error("usage: run-migration.mjs <file.sql>");
const sql = readFileSync(file, "utf8");

const REGIONS = [
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-2",
  "eu-north-1", "us-east-1", "us-east-2", "us-west-1", "us-west-2",
];
const PREFIXES = ["aws-1", "aws-0"];
// Known-good host for this tenant (discovered 2026-07-07) — tried first.
const KNOWN_HOSTS = ["aws-1-eu-central-1.pooler.supabase.com"];

async function tryHost(host) {
  const client = new pg.Client({
    host,
    port: 5432, // session mode — required for multi-statement DDL
    database: "postgres",
    user: `postgres.${REF}`,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  await client.connect();
  return client;
}

const candidates = [
  ...KNOWN_HOSTS,
  ...REGIONS.flatMap((r) => PREFIXES.map((p) => `${p}-${r}.pooler.supabase.com`)),
];

let client = null;
let connectedHost = null;
for (const host of candidates) {
  try {
    client = await tryHost(host);
    connectedHost = host;
    break;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Tenant or user not found|ENOTFOUND|timeout|ETIMEDOUT|ECONNREFUSED/i.test(msg)) {
      console.error(`${host}: ${msg.slice(0, 80)}`);
    }
  }
}
if (!client) throw new Error("could not reach the tenant on any regional pooler");
console.log(`connected via ${connectedHost}`);

try {
  await client.query(sql);
  console.log(`applied ${file} OK`);
  const { rows } = await client.query(
    `select table_name from information_schema.tables
     where table_schema='public' and table_name in
     ('closure_periods','invite_tokens','agent_tokens') order by 1`
  );
  console.log("verified tables:", rows.map((r) => r.table_name).join(", "));
} finally {
  await client.end();
}
