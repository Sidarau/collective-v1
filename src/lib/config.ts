import { env } from "process";

// Whitelabel configuration — all values are env-driven, no hardcoded brand data
export const config = {
  // Brand
  brandName: env.NEXT_PUBLIC_BRAND_NAME || "Collective",
  brandTagline: env.NEXT_PUBLIC_BRAND_TAGLINE || "Private villa living, curated.",
  supportEmail: env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@example.com",
  
  // Villa
  villaName: env.NEXT_PUBLIC_VILLA_NAME || "Roca Llisa",
  villaLocation: env.NEXT_PUBLIC_VILLA_LOCATION || "Ibiza, Spain",
  villaDescription: env.NEXT_PUBLIC_VILLA_DESCRIPTION || "A private Mediterranean villa experience.",
  
  // URLs
  baseUrl: env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  
  // HubSpot
  hubspotToken: env.HUBSPOT_SERVICE_KEY || "",
  hubspotPortalId: env.HUBSPOT_PORTAL_ID || "148787733",
  hubspotPipelineId: env.HUBSPOT_PIPELINE_ID || "default",
  hubspotStageInquiry: env.HUBSPOT_STAGE_INQUIRY || "inquiry_received",
  hubspotStageRequested: env.HUBSPOT_STAGE_REQUESTED || "requested",
  hubspotStageApproved: env.HUBSPOT_STAGE_APPROVED || "approved",
  hubspotStageBooked: env.HUBSPOT_STAGE_BOOKED || "booked",
  
  // Supabase
  supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "",
  supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "",
  supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  
  // Auth
  nextAuthSecret: env.NEXTAUTH_SECRET || "dev-secret-change-me",
  
  // Notifications
  adminEmail: env.ADMIN_EMAIL || "",
  twilioAccountSid: env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: env.TWILIO_AUTH_TOKEN || "",
  twilioWhatsAppFrom: env.TWILIO_WHATSAPP_FROM || "",
  adminWhatsApp: env.ADMIN_WHATSAPP || "",
  
  // Payments (Stripe placeholder)
  stripePublishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  stripeSecretKey: env.STRIPE_SECRET_KEY || "",
};

export function requireConfig(key: keyof typeof config): string {
  const value = config[key];
  if (!value) {
    throw new Error(`Missing required config: ${key}`);
  }
  return value;
}
