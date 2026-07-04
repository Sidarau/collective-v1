"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSetting } from "@core/settings";
import { writeAudit } from "@core/audit";
import { getAdminUser } from "./auth";

export async function toggleNotificationAction(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized");

  const key = String(formData.get("key") || "");
  const enabled = String(formData.get("enabled")) === "true";
  if (!key.startsWith("notify.")) redirect("/settings?error=Unknown+setting");

  await setSetting(key, { enabled }, admin.id);
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "settings.notification_toggle",
    entityType: "email",
    summary: `${key} → ${enabled ? "on" : "off"}`,
  });
  revalidatePath("/settings");
  redirect("/settings");
}
