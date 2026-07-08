// Read-only prod-state probe. Creds come from env (noxkey eval) — never printed.
import { createClient } from "@supabase/supabase-js";

const url = process.env.PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("missing PROJECT_URL / SUPABASE_SECRET_KEY in env");

const db = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  "users", "leads", "profiles", "applications", "villas", "rooms",
  "seasonal_pricing", "bookings", "availability_blocks", "events",
  "event_rsvps", "magic_tokens", "audit_logs", "admin_notes", "email_messages",
  "email_suppressions", "referral_credits", "payment_records", "follow_ups",
  "staff_applications", "intro_requests", "kb_nodes", "content_blocks",
  "referral_links", "screening_windows", "screening_calls", "app_settings",
];

for (const t of TABLES) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: ${error ? "ERR " + error.message.slice(0, 60) : count}`);
}

const { data: villas } = await db.from("villas").select("slug,name,status,tagline,hero_image,region,sort_order,images,story");
for (const v of villas || []) {
  console.log(`villa ${v.slug}: status=${v.status} tagline=${!!v.tagline} hero=${!!v.hero_image} images=${(v.images||[]).length} story=${!!v.story} region=${v.region}`);
}

const { data: rooms } = await db.from("rooms").select("slug,name,images,base_price_per_night").order("slug");
for (const r of rooms || []) console.log(`room ${r.slug}: "${r.name}" imgs=${(r.images||[]).length} price=${r.base_price_per_night}`);

const { data: users } = await db.from("users").select("email,role,password_hash").order("created_at");
for (const u of users || []) console.log(`user ${u.email} [${u.role}]${u.password_hash ? " +pw" : ""}`);

const { data: events } = await db.from("events").select("slug,title,start_at,status,capacity");
for (const e of events || []) console.log(`event ${e.slug}: ${e.title} @ ${e.start_at} [${e.status}] cap=${e.capacity}`);

const { data: buckets } = await db.storage.listBuckets();
console.log("storage buckets:", (buckets || []).map((b) => `${b.name}(public=${b.public})`).join(", ") || "none");
