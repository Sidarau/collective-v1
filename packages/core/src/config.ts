import { env } from "process";

// Whitelabel configuration — env-driven, no hardcoded brand data.
//
// NEXT_PUBLIC_* values reference `process.env.NEXT_PUBLIC_*` DIRECTLY: Next.js
// only statically inlines direct references into the client bundle; dynamic
// `process.env[key]` lookups resolve to undefined in the browser. getEnv stays
// for server-only values (secrets), where dynamic access guarantees they are
// never inlined into client code.
function getEnv(key: string): string | undefined {
  return env[key] || process.env[key];
}

export const config = {
  // Brand (public — inlined into the client bundle)
  brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "Collective",
  brandTagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ||
    "A private circle around the world's quiet places.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "collective@opencollective.app",

  // URLs (public). baseUrl = member app; adminUrl = operator console.
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://collective-v1-three.vercel.app",
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || "",

  // Resend
  resendApiKey: getEnv("RESEND_API_KEY") || "",
  resendFromEmail: getEnv("RESEND_FROM_EMAIL") || "collective@opencollective.app",

  // Environment
  nodeEnv: getEnv("NODE_ENV") || "development",

  // Supabase (public url/anon key inlined; service key stays server-only)
  // Fallback = the collective@zeuglab.com project (evviegqieqdmlxixwwxt).
  // Prod/preview must still set env explicitly; this only guards a missing var.
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    getEnv("SUPABASE_URL") ||
    "https://evviegqieqdmlxixwwxt.supabase.co",
  // NOTE: the zeuglab project has legacy JWT keys DISABLED, so the service-role
  // JWT returns 401. Set SUPABASE_SECRET_KEY (sb_secret_…) — not
  // SUPABASE_SERVICE_ROLE_KEY — for that project. The order below lets the
  // secret key win when the JWT var is left unset.
  supabaseServiceKey:
    getEnv("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY") || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",

  // Auth
  nextAuthSecret: getEnv("NEXTAUTH_SECRET") || "dev-secret-change-me",

  // Notifications
  adminEmail: getEnv("ADMIN_EMAIL") || "",

  // Agent access (KB REST + MCP). Endpoints refuse to serve when unset.
  agentApiToken: getEnv("AGENT_API_TOKEN") || "",

  // Google Calendar 2-way sync (server-only). Feature stays dark until both
  // are set: create an OAuth client (Web) in Google Cloud console and add
  // <adminUrl>/api/google/oauth/callback as an authorized redirect URI.
  googleClientId: getEnv("GOOGLE_OAUTH_CLIENT_ID") || "",
  googleClientSecret: getEnv("GOOGLE_OAUTH_CLIENT_SECRET") || "",
};

export function requireConfig(key: keyof typeof config): string {
  const value = config[key];
  if (!value) {
    throw new Error(`Missing required config: ${key}`);
  }
  return value;
}
