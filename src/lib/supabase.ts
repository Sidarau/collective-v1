import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

// Hardcoded for Vercel build-time compatibility
// These are public/non-sensitive values
const DEFAULT_SUPABASE_URL = "https://evviegqieqdmlxixwwxt.supabase.co";

// Use process.env directly for Next.js runtime compatibility
function getEnv(key: string): string | undefined {
  return process.env[key];
}

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY") || "";
const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "";

// Server-side Supabase client (service role for admin operations)
// Lazy initialization to avoid build-time errors
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      supabaseUrl || DEFAULT_SUPABASE_URL,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return _supabaseAdmin;
}

// Backward-compatible export for existing (server-side) code.
//
// IMPORTANT: this must NOT eagerly call getSupabaseAdmin() at module load.
// The portal client components import `createBrowserClient` from this same
// module, so the whole module is evaluated in the browser bundle. An eager
// `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` there throws "supabaseKey is
// required" (the service-role key is server-only), which crashes hydration and
// shows Safari/Chrome "This page couldn't load". A lazy Proxy defers client
// creation until a property is actually accessed — which only happens in
// server code — so importing this module in the browser is now side-effect free.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Browser-side Supabase client.
//
// These MUST reference process.env.NEXT_PUBLIC_* DIRECTLY (not via the getEnv()
// helper). Next.js/Turbopack only statically inlines direct `process.env.NEXT_PUBLIC_FOO`
// references into the client bundle; a dynamic `process.env[key]` lookup is left
// as-is and resolves to `undefined` in the browser, so the anon key would be empty
// and @supabase/ssr throws "Your project's URL and API key are required".
export function createBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createSupabaseBrowserClient(url, anonKey);
}
