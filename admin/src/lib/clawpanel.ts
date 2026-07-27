import "server-only";

// Server-to-server bridge to ClawPanel's embed-token broker. collective-admin
// authenticates its own admins, then mints a short-lived (30min) embed token
// for the current user so <clawpanel-chat> can talk to the hosted agent. The
// broker secret never leaves this server; the user never sees a token.

const CLAWPANEL_URL = process.env.CLAWPANEL_URL ?? "https://clawpanel.app";
const BROKER_SECRET = process.env.CLAWPANEL_EMBED_BROKER_SECRET;
const TENANT = process.env.CLAWPANEL_TENANT ?? "alex";

export interface EmbedGrant {
  token: string;
  expiresAt: string;
  apiUrl: string;
  agentId: string;
}

// Mint an embed token for a collective-admin user. Returns null when the
// broker isn't configured or the user isn't provisioned in ClawPanel — the
// caller renders a graceful "chat unavailable" state instead of throwing.
export async function mintCollectaEmbed(email: string): Promise<EmbedGrant | null> {
  if (!BROKER_SECRET) return null;
  const agentId = process.env.CLAWPANEL_COLLECTA_AGENT_ID;
  if (!agentId) return null;
  try {
    const res = await fetch(`${CLAWPANEL_URL}/api/embed-token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${BROKER_SECRET}`,
      },
      body: JSON.stringify({ tenant_slug: TENANT, email }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string; expires_at?: string };
    if (!data.token) return null;
    return { token: data.token, expiresAt: data.expires_at ?? "", apiUrl: CLAWPANEL_URL, agentId };
  } catch {
    return null;
  }
}
