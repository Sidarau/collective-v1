// One-off read-only prod query via the supavisor pooler (same pattern as
// scripts/run-migration.mjs). Usage: SUPABASE_DB_PASSWORD=... node db-query.mjs "<sql>"
import pg from "pg";

const password = process.env.SUPABASE_DB_PASSWORD;
const sql = process.argv[2];
if (!password) throw new Error("SUPABASE_DB_PASSWORD not in env");
if (!sql) throw new Error("usage: db-query.mjs <sql>");

const client = new pg.Client({
  host: "aws-1-eu-central-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.evviegqieqdmlxixwwxt",
  password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});
await client.connect();
const { rows } = await client.query(sql);
console.log(JSON.stringify(rows, null, 1));
await client.end();
