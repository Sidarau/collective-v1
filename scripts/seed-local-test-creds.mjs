import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

dotenv.config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const hostname = url ? new URL(url).hostname : "";
const local = hostname === "127.0.0.1" || hostname === "localhost";

if (!url || !key) {
  throw new Error("Missing Supabase URL or service key in .env.local");
}

if (!local && process.env.CONFIRM_REMOTE_TEST_CREDS !== "1") {
  throw new Error(
    `Refusing to reset fixture credentials on remote project ${hostname}. ` +
      "Set CONFIRM_REMOTE_TEST_CREDS=1 if this is intentional."
  );
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "CollectiveLocal2026!";
const password_hash = await bcrypt.hash(PASSWORD, 12);

const fixtures = [
  {
    email: "test-admin@collective.test",
    role: "admin",
    profile: {
      first_name: "Dev",
      last_name: "Operator",
      headline: "Console test account",
      location: "Localhost",
      bio: "Local test operator account.",
      visibility: "hidden",
      onboarding_completed: true,
    },
  },
  {
    email: "test-member@collective.test",
    role: "member",
    profile: {
      first_name: "Rafael",
      last_name: "Costa",
      headline: "Capital intros and ocean projects",
      location: "Lisbon, Portugal",
      bio: "Local test member profile.",
      contribution: "Capital introductions and a standing invitation to sail the Tagus",
      visibility: "members",
      onboarding_completed: true,
    },
  },
  {
    email: "test-newmember@collective.test",
    role: "lead",
    profile: null,
  },
];

for (const fixture of fixtures) {
  const { data: lead, error: leadError } = await db
    .from("leads")
    .upsert(
      {
        email: fixture.email,
        first_name: fixture.profile?.first_name || "Test",
        last_name: fixture.profile?.last_name || "Lead",
        source: "local_test_fixture",
        status: "active",
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();
  if (leadError || !lead) throw new Error(leadError?.message || `Lead failed for ${fixture.email}`);

  const { data: user, error: userError } = await db
    .from("users")
    .upsert(
      {
        email: fixture.email,
        role: fixture.role,
        lead_id: lead.id,
        password_hash,
        phone: null,
        phone_verified: false,
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();
  if (userError || !user) throw new Error(userError?.message || `User failed for ${fixture.email}`);

  if (fixture.profile) {
    const { error: profileError } = await db
      .from("profiles")
      .upsert({ user_id: user.id, ...fixture.profile }, { onConflict: "user_id" });
    if (profileError) throw new Error(profileError.message);
  }

  console.log(`${fixture.email} ready`);
}

console.log(`Password for all fixtures: ${PASSWORD}`);
