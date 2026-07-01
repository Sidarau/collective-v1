import { env } from "process";

// Whitelabel configuration — all values are env-driven, no hardcoded brand data.
//
// NEXT_PUBLIC_* values below reference `process.env.NEXT_PUBLIC_*` DIRECTLY.
// Next.js/Turbopack only statically inlines direct references into the client
// bundle; a dynamic `process.env[key]` lookup (the getEnv helper) resolves to
// undefined in the browser, so those values would silently fall back to the
// defaults client-side. getEnv is kept for server-only values (secrets), where
// dynamic access is fine — and actually desirable, since it guarantees they are
// never inlined into client code.
function getEnv(key: string): string | undefined {
  return env[key] || process.env[key];
}

export const config = {
  // Brand (public — inlined into the client bundle)
  brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "Collective",
  brandTagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Private villa living, curated.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@example.com",

  // Villa (public)
  villaName: process.env.NEXT_PUBLIC_VILLA_NAME || "Roca Llisa",
  villaLocation: process.env.NEXT_PUBLIC_VILLA_LOCATION || "Ibiza, Spain",
  villaDescription: process.env.NEXT_PUBLIC_VILLA_DESCRIPTION || "A private Mediterranean villa experience.",

  // URLs (public)
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://collective-v1-three.vercel.app",

  // HubSpot
  hubspotToken: getEnv("HUBSPOT_SERVICE_KEY") || "",
  hubspotPortalId: getEnv("HUBSPOT_PORTAL_ID") || "148787733",
  hubspotPipelineId: getEnv("HUBSPOT_PIPELINE_ID") || "default",
  hubspotStageInquiry: getEnv("HUBSPOT_STAGE_INQUIRY") || "5612484839",
  hubspotStageRequested: getEnv("HUBSPOT_STAGE_REQUESTED") || "5612484840",
  hubspotStageApproved: getEnv("HUBSPOT_STAGE_APPROVED") || "5612484841",
  hubspotStageBooked: getEnv("HUBSPOT_STAGE_BOOKED") || "5612484842",
  hubspotStagePaid: getEnv("HUBSPOT_STAGE_PAID") || "5612484842",
  hubspotStageCancelled: getEnv("HUBSPOT_STAGE_CANCELLED") || "5612484843",
  hubspotMagicLinkEmailId: getEnv("HUBSPOT_MAGIC_LINK_EMAIL_ID") || "",
  hubspotWebhookSecret: getEnv("HUBSPOT_WEBHOOK_SECRET") || "",

  // Resend
  resendApiKey: getEnv("RESEND_API_KEY") || "",
  resendFromEmail: getEnv("RESEND_FROM_EMAIL") || "onboarding@resend.dev",

  // Environment
  nodeEnv: getEnv("NODE_ENV") || "development",
  
  // Supabase (public url/anon key inlined; service key stays server-only)
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || getEnv("SUPABASE_URL") || "https://placeholder.supabase.co",
  supabaseServiceKey: getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY") || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  
  // Auth
  nextAuthSecret: getEnv("NEXTAUTH_SECRET") || "dev-secret-change-me",
  
  // Notifications
  adminEmail: getEnv("ADMIN_EMAIL") || "",
  twilioAccountSid: getEnv("TWILIO_ACCOUNT_SID") || "",
  twilioAuthToken: getEnv("TWILIO_AUTH_TOKEN") || "",
  twilioWhatsAppFrom: getEnv("TWILIO_WHATSAPP_FROM") || "",
  adminWhatsApp: getEnv("ADMIN_WHATSAPP") || "",
  
  // Payments (public publishable key inlined; secret key stays server-only)
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  stripeSecretKey: getEnv("STRIPE_SECRET_KEY") || "",
};

export function requireConfig(key: keyof typeof config): string {
  const value = config[key];
  if (!value) {
    throw new Error(`Missing required config: ${key}`);
  }
  return value;
}
