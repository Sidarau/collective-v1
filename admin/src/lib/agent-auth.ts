import "server-only";
import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "@core/config";
import { getSupabaseAdmin } from "@core/supabase";
import type { AgentTokenScope } from "@core/database.types";
import type { Principal } from "@core/policy";
import { getAdminUser } from "./auth";

/**
 * Agent surface auth (KB REST + MCP). Three ways in:
 *  - per-admin token (osk_…, Settings → Agents & MCP) → attributed to that admin
 *  - the shared AGENT_API_TOKEN env token → attributed to "system"
 *  - an admin console session (the UI itself)
 * Fail-closed: bearer present but unknown → 401; no bearer and no session → 401.
 */
export interface AgentIdentity {
  kind: "admin_token" | "system_token" | "session";
  adminId: string | null;
  adminEmail: string | null;
  tokenId: string | null;
  tokenLabel: string | null;
  scope: AgentTokenScope; // owner (default) | staff — tier of the token
}

/**
 * Map the transport-level identity to a policy Principal (ADR §3.1). Console
 * sessions are humans (operator) and may exercise human-only capabilities;
 * token-backed identities are agents whose scope caps them to drafts.
 */
export function toPrincipal(id: AgentIdentity): Principal {
  if (id.kind === "session") {
    return { kind: "operator", userId: id.adminId, entityId: null, via: "session", tokenId: null };
  }
  return {
    kind: "agent",
    userId: id.adminId,
    entityId: null,
    agentScope: id.scope,
    via: id.kind === "system_token" ? "system_token" : "agent_token",
    tokenId: id.tokenId,
  };
}

export const agentContext = new AsyncLocalStorage<AgentIdentity>();

export function hashAgentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function resolveAgent(req: Request): Promise<AgentIdentity | NextResponse> {
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (bearer) {
    // Per-admin tokens first (they're the attributable path).
    if (bearer.startsWith("osk_")) {
      const supabase = getSupabaseAdmin();
      const { data: row } = await supabase
        .from("agent_tokens")
        .select("id, admin_id, label, revoked_at, scope")
        .eq("token_hash", hashAgentToken(bearer))
        .maybeSingle();
      if (row && !row.revoked_at) {
        const { data: owner } = await supabase
          .from("users")
          .select("email")
          .eq("id", row.admin_id)
          .maybeSingle();
        // Fire-and-forget freshness marker; never block the request on it.
        void supabase
          .from("agent_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", row.id)
          .then(() => {});
        return {
          kind: "admin_token",
          adminId: row.admin_id,
          adminEmail: owner?.email || null,
          tokenId: row.id,
          tokenLabel: row.label,
          scope: row.scope === "staff" ? "staff" : "owner",
        };
      }
      return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
    }

    // Shared system token (env), for Alex's own infra agents.
    if (config.agentApiToken) {
      const a = Buffer.from(bearer);
      const b = Buffer.from(config.agentApiToken);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return {
          kind: "system_token",
          adminId: null,
          adminEmail: "system",
          tokenId: null,
          tokenLabel: "AGENT_API_TOKEN",
          scope: "owner",
        };
      }
    }
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const admin = await getAdminUser();
  if (admin) {
    return {
      kind: "session",
      adminId: admin.id,
      adminEmail: admin.email,
      tokenId: null,
      tokenLabel: null,
      scope: "owner",
    };
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Back-compat wrapper for read-only routes: NextResponse when denied, null when allowed. */
export async function requireAgentOrAdmin(req: Request): Promise<NextResponse | null> {
  const result = await resolveAgent(req);
  return result instanceof NextResponse ? result : null;
}
