// Email delivery via HubSpot transactional email (single-send API)
// Falls back to logging the link in non-production environments.

import { config } from "./config";

interface SendMagicLinkParams {
  to: string;
  firstName: string;
  magicLink: string;
}

export async function sendMagicLinkEmail({ to, firstName, magicLink }: SendMagicLinkParams): Promise<void> {
  if (config.nodeEnv !== "production") {
    console.log(`[DEV] Magic link for ${to}: ${magicLink}`);
    return;
  }

  if (!config.hubspotToken) {
    console.warn("HUBSPOT_SERVICE_KEY not configured; skipping email send.");
    return;
  }

  const res = await fetch("https://api.hubapi.com/marketing/v3/transactional/single-email/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.hubspotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      emailId: config.hubspotMagicLinkEmailId || undefined,
      message: {
        to: to,
      },
      contactProperties: {
        firstname: firstName,
      },
      customProperties: {
        magic_link: magicLink,
        brand_name: config.brandName,
        villa_name: config.villaName,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot email send failed ${res.status}: ${text.slice(0, 500)}`);
  }
}
