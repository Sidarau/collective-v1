import { createClient } from "@supabase/supabase-js";
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { config } from "./config";

// Server-side Supabase client (service role for admin operations)
export const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
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
    config.supabaseUrl,
    config.supabaseAnonKey
  );
}
