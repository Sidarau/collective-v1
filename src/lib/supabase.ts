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

// Backward-compatible export for existing code
export const supabaseAdmin = getSupabaseAdmin();

// Browser-side Supabase client
export function createBrowserClient(): SupabaseClient {
  return createSupabaseBrowserClient(
    supabaseUrl || DEFAULT_SUPABASE_URL,
    supabaseAnonKey
  );
}
