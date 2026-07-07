// Direct HubSpot API client using fetch — avoids @hubspot/api-client TS issues
import { config } from "./config";
import { getSupabaseAdmin } from "./supabase";

const HUBSPOT_API = "https://api.hubapi.com";

async function hubspotFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.hubspotToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

/**
 * Admin/operator accounts must never be synced to HubSpot — Alex + Dominik use
 * their real emails to test the funnel end-to-end. Role lookup in Supabase is
 * the source of truth (no hardcoded email list).
 */
export async function isCrmExemptEmail(email: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("users")
    .select("role")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  return !!data && ["admin", "operator"].includes(data.role);
}

export interface HubSpotContactInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  whatsapp?: string;
  occupation?: string;
  location?: string;
  source?: string;
}

export async function createHubSpotContact(lead: HubSpotContactInput): Promise<string> {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.firstName,
    lastname: lead.lastName,
  };
  if (lead.phone) properties.phone = lead.phone;
  if (lead.whatsapp) properties.hs_whatsapp_phone_number = lead.whatsapp;
  if (lead.occupation) properties.jobtitle = lead.occupation;
  if (lead.location) properties.city = lead.location;

  try {
    const data = await hubspotFetch("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({ properties }),
    });
    return data.id as string;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Contact already exists")) {
      const match = message.match(/Existing ID: (\d+)/);
      if (match) return match[1];
    }
    throw err;
  }
}

export async function createHubSpotDeal(
  contactId: string,
  dealName: string,
  amount: number = 0
): Promise<string> {
  const dealData = await hubspotFetch("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname: dealName,
        amount: amount.toString(),
        pipeline: config.hubspotPipelineId,
        dealstage: config.hubspotStageInquiry,
      },
    }),
  });

  await hubspotFetch(
    `/crm/v4/objects/deals/${dealData.id}/associations/contacts/${contactId}`,
    {
      method: "PUT",
      body: JSON.stringify([
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
      ]),
    }
  );

  return dealData.id as string;
}

export async function updateContactMagicLink(contactId: string, magicLink: string) {
  await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { magic_link: magicLink } }),
  });
}

export async function getHubSpotContactByEmail(email: string): Promise<string | null> {
  try {
    const data = (await hubspotFetch(`/crm/v3/objects/contacts/search`, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
        ],
        properties: ["email"],
        limit: 1,
      }),
    })) as { results?: { id: string }[] };
    return data.results?.[0]?.id || null;
  } catch (error) {
    console.error("Failed to find HubSpot contact:", error);
    return null;
  }
}

export async function updateDealStage(dealId: string, stage: string) {
  await hubspotFetch(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { dealstage: stage } }),
  });
}
