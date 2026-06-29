import { createClient } from "@supabase/supabase-js";
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

// Use process.env directly for Next.js runtime compatibility
function getEnv(key: string): string | undefined {
  return process.env[key];
}

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL") || "https://placeholder.supabase.co";
const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY") || "";
const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "";

// Server-side Supabase client (service role for admin operations)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Browser-side Supabase client
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}
