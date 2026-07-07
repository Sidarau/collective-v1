import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Public/non-sensitive fallback for Vercel build-time compatibility.
const DEFAULT_SUPABASE_URL = "https://iudicmvyihswhvgmyvcf.supabase.co";

function getEnv(key: string): string | undefined {
  return process.env[key];
}

const supabaseUrl =
  getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
const supabaseServiceKey =
  getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY") || "";

export type Db = SupabaseClient<Database>;

// Server-side Supabase client (service role). Lazy so importing this module in
// a browser bundle is side-effect free — the service key only exists on the
// server, and an eager createClient() there crashes hydration (ZEUG-414).
let _supabaseAdmin: Db | null = null;
export function getSupabaseAdmin(): Db {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseAdmin;
}

// Browser-side client. MUST reference process.env.NEXT_PUBLIC_* directly so
// Next statically inlines the values into the client bundle (ZEUG-414).
export function createBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createSupabaseBrowserClient(url, anonKey);
}
