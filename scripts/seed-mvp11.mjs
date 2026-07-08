// MVP 1.1 content restore for the production DB (evviegqieqdmlxixwwxt).
// Idempotent: villa/room content only fills empty fields; events/profiles/users
// upsert on natural keys. Run: with PROJECT_URL + SUPABASE_SECRET_KEY in env.
import { createClient } from "@supabase/supabase-js";

const url = process.env.PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("missing PROJECT_URL / SUPABASE_SECRET_KEY");
const db = createClient(url, key, { auth: { persistSession: false } });

const U = (id, w = 2000) =>
  `https://images.unsplash.com/photo-${id}?q=80&w=${w}&auto=format&fit=crop`;

// ---------- 1. Villa presentation ----------
const { data: villa } = await db.from("villas").select("*").eq("slug", "roca-llisa").single();
if (!villa) throw new Error("roca-llisa missing");

await db
  .from("villas")
  .update({
    tagline: villa.tagline || "Private estate in Roca Llisa",
    region: villa.region || "Ibiza",
    story:
      villa.story ||
      "A quiet estate above the eastern coast, kept for the Circle. Mornings on the terrace, long dinners under the pines, and a calendar of member-hosted sessions through the season. Request your window, bring one guest, and contribute something only you can.",
    hero_image: villa.hero_image || U("1512917774080-9991f1c4c750", 2400),
    images:
      (villa.images || []).length > 0
        ? villa.images
        : [U("1512917774080-9991f1c4c750", 2400), U("1600596542815-ffad4c1539a9", 2400), U("1600607687939-ce8a6c25118c", 2400)],
    status: "published",
  })
  .eq("id", villa.id);
console.log("villa content restored");

// ---------- 2. Room images (1-3 lost theirs in relocation) ----------
const roomImages = {
  "room-1": U("1590490360182-c33d57733427", 1800),
  "room-2": U("1595576508898-0ad5c879a061", 1800),
  "room-3": U("1611892440504-42a792e24d32", 1800),
};
for (const [slug, img] of Object.entries(roomImages)) {
  const { data: room } = await db.from("rooms").select("id, images").eq("villa_id", villa.id).eq("slug", slug).single();
  if (room && (room.images || []).length === 0) {
    await db.from("rooms").update({ images: [img] }).eq("id", room.id);
    console.log(`${slug} image set`);
  }
}

// ---------- 3. July events (Europe/Madrid = +02:00 in summer) ----------
const EVENTS = [
  {
    slug: "cova-santa-laurens-birthday",
    title: "Cova Santa × Lauren's Birthday",
    event_type: "dinner",
    audience: "member",
    start_at: "2026-07-10T20:00:00+02:00",
    end_at: "2026-07-10T23:59:00+02:00",
    description:
      "Lauren Gilbert's birthday dinner, then down the hill to Cova Santa — Yulia Niko on the decks. Cars leave the villa at nine.",
    image: U("1470225620780-dba8ba36b745", 1800),
    location_note: "Villa dinner → Cova Santa",
    capacity: null,
    hard_capacity: null,
  },
  {
    slug: "midnight-poolside-alex",
    title: "Midnight Poolside — Alex's Birthday",
    event_type: "gathering",
    audience: "member",
    start_at: "2026-07-11T00:00:00+02:00",
    end_at: "2026-07-11T04:00:00+02:00",
    description:
      "When the clocks turn, the party comes home. Poolside vibes as Lauren's night becomes Alex Sidarau's birthday.",
    image: U("1445019980597-93fa8acb246c", 1800),
    location_note: "The pool deck",
    capacity: null,
    hard_capacity: null,
  },
  {
    slug: "alex-birthday-dinner",
    title: "Birthday Dinner at the Villa",
    event_type: "dinner",
    audience: "member",
    start_at: "2026-07-11T20:30:00+02:00",
    end_at: "2026-07-11T23:30:00+02:00",
    description: "Alex's birthday table under the pines. One long table, no phones.",
    image: U("1414235077428-338989a2e8c0", 1800),
    location_note: "The long table",
    capacity: null,
    hard_capacity: null,
  },
  {
    slug: "pilates-infinity-pool",
    title: "Pilates by the Infinity Pool",
    event_type: "wellness",
    audience: "member",
    start_at: "2026-07-15T09:30:00+02:00",
    end_at: "2026-07-15T10:30:00+02:00",
    description: "Morning session on the pool deck with the sea below. Mats provided — 15 spots.",
    image: U("1544367567-0f2fcb009e0b", 1800),
    location_note: "Infinity pool deck",
    capacity: 15,
    hard_capacity: 20,
  },
  {
    slug: "roca-llisa-sunset-guest-table",
    title: "Roca Llisa Sunset Guest Table",
    event_type: "gathering",
    audience: "public",
    start_at: "2026-07-18T19:30:00+02:00",
    end_at: "2026-07-18T22:00:00+02:00",
    description:
      "A small guest-list sunset table for friends of the Circle curious about the Collective.",
    image: U("1507525428034-b723cf961d3e", 1800),
    location_note: "Upper terrace",
    capacity: 18,
    hard_capacity: 24,
  },
];
for (const e of EVENTS) {
  const { data: existing } = await db.from("events").select("id").eq("slug", e.slug).maybeSingle();
  if (existing) {
    await db.from("events").update({ ...e, villa_id: villa.id, status: "published" }).eq("id", existing.id);
  } else {
    await db.from("events").insert({ ...e, villa_id: villa.id, status: "published" });
  }
  console.log(`event ${e.slug} upserted`);
}

// ---------- 4. Close the house from Aug 10, indefinitely ----------
const { data: closure } = await db
  .from("closure_periods")
  .select("id")
  .eq("villa_id", villa.id)
  .is("ends_on", null)
  .eq("starts_on", "2026-08-10")
  .maybeSingle();
if (!closure) {
  await db.from("closure_periods").insert({
    villa_id: villa.id,
    starts_on: "2026-08-10",
    ends_on: null,
    reason: "House closed — end of member season",
  });
  console.log("closure inserted: 2026-08-10 → ∞");
}

// ---------- 5. Dev test fixtures (DELETE BEFORE LAUNCH) ----------
const FIXTURE_USERS = [
  {
    email: "test-admin@collective.test",
    role: "admin",
    password_hash: "$2b$12$lYFZj203tgB48WPmpvifC.4.HfZDqgSm0gmV4IODzlMQU8ZmuPrku",
    profile: {
      first_name: "Dev",
      last_name: "Operator",
      headline: "Console test account",
      location: "Localhost",
      bio: "Delete before launch.",
      visibility: "hidden",
      onboarding_completed: true,
    },
  },
  {
    email: "test-member@collective.test",
    role: "member",
    password_hash: "$2b$12$lYFZj203tgB48WPmpvifC.4.HfZDqgSm0gmV4IODzlMQU8ZmuPrku",
    profile: {
      first_name: "Rafael",
      last_name: "Costa",
      headline: "Capital intros and ocean projects",
      location: "Lisbon, Portugal",
      bio: "Building bridges between **family capital** and the blue economy.\n\n- Blue-economy funds and coastal real estate\n- Marina infrastructure across Iberia\n- Regenerative aquaculture pilots\n\n*Ask me about the Azores.*",
      contribution: "Capital introductions, and a standing invitation to sail the Tagus",
      visibility: "members",
      onboarding_completed: true,
    },
  },
  {
    email: "test-newmember@collective.test",
    role: "lead",
    password_hash: "$2b$12$lYFZj203tgB48WPmpvifC.4.HfZDqgSm0gmV4IODzlMQU8ZmuPrku",
    profile: null,
  },
];
for (const f of FIXTURE_USERS) {
  const { data: u } = await db
    .from("users")
    .upsert({ email: f.email, role: f.role, password_hash: f.password_hash }, { onConflict: "email" })
    .select("id")
    .single();
  if (f.profile && u) {
    const { data: p } = await db.from("profiles").select("id").eq("user_id", u.id).maybeSingle();
    if (!p) await db.from("profiles").insert({ user_id: u.id, ...f.profile });
  }
  console.log(`fixture ${f.email} ready`);
}

// test-member needs a lead row for the booking FK path
const { data: tm } = await db.from("users").select("id, lead_id").eq("email", "test-member@collective.test").single();
if (tm && !tm.lead_id) {
  const { data: lead } = await db
    .from("leads")
    .upsert(
      { email: "test-member@collective.test", first_name: "Rafael", last_name: "Costa", source: "dev_fixture", status: "active" },
      { onConflict: "email" }
    )
    .select("id")
    .single();
  if (lead) await db.from("users").update({ lead_id: lead.id }).eq("id", tm.id);
}

// ---------- 6. Real-people profiles (only when missing; owners edit in-app) ----------
const PEOPLE = [
  {
    email: "alex@zeuglab.com",
    first_name: "Alex",
    last_name: "Sidarau",
    headline: "Zeug Lab — AI operating infrastructure",
    location: "Los Angeles / Ibiza",
    bio: "Building the operating system behind the Collective.",
    contribution: "AI ops audits and automation sessions for member companies",
  },
  {
    email: "dominik@mission-mastery.com",
    first_name: "Dominik",
    last_name: "Mastery",
    headline: "Mission Mastery — Founder",
    location: "Germany / Ibiza",
    bio: "Curating the Circle and the first Gate.",
    contribution: "Host calls, estate access, and the founding network",
  },
  {
    email: "manuel@mission-mastery.com",
    first_name: "Manuel",
    last_name: "Uhlitzsch",
    headline: "Mission Mastery",
    location: "Germany",
    bio: "Founding circle.",
    contribution: "Operations at the Gate",
  },
];
for (const p of PEOPLE) {
  const { data: u } = await db.from("users").select("id").eq("email", p.email).maybeSingle();
  if (!u) continue;
  const { data: existing } = await db.from("profiles").select("id").eq("user_id", u.id).maybeSingle();
  if (!existing) {
    const { email, ...fields } = p;
    await db.from("profiles").insert({ user_id: u.id, ...fields, onboarding_completed: true, visibility: "members" });
    console.log(`profile created for ${email}`);
  }
}

// ---------- 7. A little life on the calendar ----------
const { data: cova } = await db.from("events").select("id").eq("slug", "cova-santa-laurens-birthday").single();
const { data: pilates } = await db.from("events").select("id").eq("slug", "pilates-infinity-pool").single();
const { data: rsvpUsers } = await db
  .from("users")
  .select("id, email")
  .in("email", ["alex@zeuglab.com", "dominik@mission-mastery.com", "test-member@collective.test"]);
for (const u of rsvpUsers || []) {
  for (const ev of [cova, pilates]) {
    if (!ev) continue;
    const { data: r } = await db.from("event_rsvps").select("id").eq("event_id", ev.id).eq("user_id", u.id).maybeSingle();
    if (!r) await db.from("event_rsvps").insert({ event_id: ev.id, user_id: u.id, status: "going" });
  }
}
console.log("rsvps seeded");

const counts = {};
for (const t of ["events", "profiles", "closure_periods", "event_rsvps"]) {
  const { count } = await db.from(t).select("*", { count: "exact", head: true });
  counts[t] = count;
}
console.log("final:", JSON.stringify(counts));
