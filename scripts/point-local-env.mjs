// Point local dev (.env.local for member + admin) at the production Supabase
// project (collective@zeuglab.com / evviegqieqdmlxixwwxt). Values come from env
// (noxkey eval) and are never printed. SERVICE_ROLE_KEY is blanked so the
// sb_secret key wins (legacy JWT is disabled on this project).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const url = process.env.PROJECT_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !secret || !publishable) throw new Error("missing PROJECT_URL / SUPABASE_SECRET_KEY / SUPABASE_PUBLISHABLE_KEY in env");

const SET = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: secret,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable,
  SUPABASE_SERVICE_ROLE_KEY: "", // must not win over the secret key
};

for (const path of [".env.local", "admin/.env.local"]) {
  let lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  const seen = new Set();
  lines = lines.map((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && m[1] in SET) {
      seen.add(m[1]);
      return `${m[1]}=${SET[m[1]]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(SET)) {
    if (!seen.has(k)) lines.push(`${k}=${v}`);
  }
  writeFileSync(path, lines.join("\n"));
  console.log(`${path}: pointed at ${url.slice(8, 28)}…`);
}
