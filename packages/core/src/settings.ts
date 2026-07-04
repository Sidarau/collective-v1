import { getSupabaseAdmin } from "./supabase";
import type { Json } from "./database.types";

/**
 * Operator-tunable switches stored in `app_settings` (key → jsonb). Used for
 * notification toggles; unknown keys fall back to enabled so a missing row
 * never silently kills an email the operator expects.
 */

export async function getSettingValue<T extends Json = Json>(key: string): Promise<T | null> {
  const { data } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as T) ?? null;
}

export async function isToggleEnabled(key: string, fallback = true): Promise<boolean> {
  const value = await getSettingValue<{ enabled?: boolean }>(key);
  if (value == null || typeof value !== "object") return fallback;
  return value.enabled !== false;
}

export async function setSetting(key: string, value: Json, updatedBy?: string | null): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("app_settings")
    .upsert({ key, value, updated_by: updatedBy || null, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Failed to save setting ${key}: ${error.message}`);
}

/** All notification toggles surfaced in the console. */
export const NOTIFICATION_TOGGLES: { key: string; label: string; description: string }[] = [
  {
    key: "notify.admin_on_application",
    label: "New member application → operators",
    description: "Email the admin address when a prospect submits an application.",
  },
  {
    key: "notify.admin_on_vendor_application",
    label: "New vendor application → operators",
    description: "Email the admin address when a vendor/staff candidate applies.",
  },
  {
    key: "notify.admin_on_booking_request",
    label: "New stay request → operators",
    description: "Email the admin address when a member requests a window.",
  },
  {
    key: "notify.prospect_on_screening_booked",
    label: "Screening booked → prospect",
    description: "Confirmation email with calendar link when a call is booked.",
  },
  {
    key: "notify.admin_on_screening_booked",
    label: "Screening booked → operators",
    description: "Notify the admin address when a call lands in the schedule.",
  },
];
