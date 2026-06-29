import { env } from "process";

// Whitelabel configuration — all values are env-driven, no hardcoded brand data
// Use process.env directly for Next.js runtime compatibility
function getEnv(key: string): string | undefined {
  return env[key] || process.env[key];
}

export const config = {
  // Brand
  brandName: getEnv("NEXT_PUBLIC_BRAND_NAME") || "Collective",
  brandTagline: getEnv("NEXT_PUBLIC_BRAND_TAGLINE") || "Private villa living, curated.",
  supportEmail: getEnv("NEXT_PUBLIC_SUPPORT_EMAIL") || "hello@example.com",
  
  // Villa
  villaName: getEnv("NEXT_PUBLIC_VILLA_NAME") || "Roca Llisa",
  villaLocation: getEnv("NEXT_PUBLIC_VILLA_LOCATION") || "Ibiza, Spain",
  villaDescription: getEnv("NEXT_PUBLIC_VILLA_DESCRIPTION") || "A private Mediterranean villa experience.",
  
  // URLs
  baseUrl: getEnv("NEXT_PUBLIC_BASE_URL") || "http://localhost:3000",
  
  // HubSpot
  hubspotToken: getEnv("HUBSPOT_SERVICE_KEY") || "",
  hubspotPortalId: getEnv("HUBSPOT_PORTAL_ID") || "148787733",
  hubspotPipelineId: getEnv("HUBSPOT_PIPELINE_ID") || "default",
  hubspotStageInquiry: getEnv("HUBSPOT_STAGE_INQUIRY") || "inquiry_received",
  hubspotStageRequested: getEnv("HUBSPOT_STAGE_REQUESTED") || "requested",
  hubspotStageApproved: getEnv("HUBSPOT_STAGE_APPROVED") || "approved",
  hubspotStageBooked: getEnv("HUBSPOT_STAGE_BOOKED") || "booked",
  hubspotStagePaid: getEnv("HUBSPOT_STAGE_PAID") || "paid",
  hubspotStageCancelled: getEnv("HUBSPOT_STAGE_CANCELLED") || "cancelled",
  hubspotMagicLinkEmailId: getEnv("HUBSPOT_MAGIC_LINK_EMAIL_ID") || "",
  hubspotWebhookSecret: getEnv("HUBSPOT_WEBHOOK_SECRET") || "",

  // Environment
  nodeEnv: getEnv("NODE_ENV") || "development",
  
  // Supabase
  supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL") || "https://placeholder.supabase.co",
  supabaseServiceKey: getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SECRET_KEY") || "",
  supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "",
  
  // Auth
  nextAuthSecret: getEnv("NEXTAUTH_SECRET") || "dev-secret-change-me",
  
  // Notifications
  adminEmail: getEnv("ADMIN_EMAIL") || "",
  twilioAccountSid: getEnv("TWILIO_ACCOUNT_SID") || "",
  twilioAuthToken: getEnv("TWILIO_AUTH_TOKEN") || "",
  twilioWhatsAppFrom: getEnv("TWILIO_WHATSAPP_FROM") || "",
  adminWhatsApp: getEnv("ADMIN_WHATSAPP") || "",
  
  // Payments (Stripe placeholder)
  stripePublishableKey: getEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") || "",
  stripeSecretKey: getEnv("STRIPE_SECRET_KEY") || "",
};

export function requireConfig(key: keyof typeof config): string {
  const value = config[key];
  if (!value) {
    throw new Error(`Missing required config: ${key}`);
  }
  return value;
}
