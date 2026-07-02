// Direct HubSpot API client using fetch — avoids @hubspot/api-client TypeScript issues
import { config } from "./config";

const HUBSPOT_API = "https://api.hubapi.com";
const token = config.hubspotToken;

async function hubspotFetch(path: string, options: RequestInit = {}) {
  const url = `${HUBSPOT_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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

export async function createHubSpotContact(lead: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  whatsapp?: string;
  source?: string;
}) {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.firstName,
    lastname: lead.lastName,
  };
  if (lead.phone) properties.phone = lead.phone;
  if (lead.whatsapp) properties.hs_whatsapp_phone_number = lead.whatsapp;
  // hs_analytics_source is an enum; skip generic source mapping for now

  const data = await hubspotFetch("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
  return data.id as string;
}

export async function createHubSpotDeal(contactId: string, dealName: string, amount: number = 0) {
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

  // Associate deal with contact
  await hubspotFetch(`/crm/v4/objects/deals/${dealData.id}/associations/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify([
      {
        associationCategory: "HUBSPOT_DEFINED",
        associationTypeId: 3,
      },
    ]),
  });

  return dealData.id as string;
}

export async function updateContactMagicLink(contactId: string, magicLink: string) {
  await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: { magic_link: magicLink },
    }),
  });
}

export async function getHubSpotContactByEmail(email: string): Promise<string | null> {
  try {
    const data = (await hubspotFetch(`/crm/v3/objects/contacts/search`, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [{ propertyName: "email", operator: "EQ", value: email }],
          },
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
    body: JSON.stringify({
      properties: { dealstage: stage },
    }),
  });
}

export async function updateDealAmount(dealId: string, amount: number) {
  await hubspotFetch(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: { amount: amount.toString() },
    }),
  });
}
