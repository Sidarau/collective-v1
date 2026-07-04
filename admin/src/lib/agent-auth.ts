import "server-only";
import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { config } from "@core/config";
import { getAdminUser } from "./auth";

/**
 * KB / MCP agent access: a Bearer AGENT_API_TOKEN (for agents) or an admin
 * session (for the console itself). Endpoints refuse to serve when the token
 * isn't configured, so there is no accidentally-open state.
 */
export async function requireAgentOrAdmin(req: Request): Promise<NextResponse | null> {
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (bearer) {
    if (!config.agentApiToken) {
      return NextResponse.json(
        { error: "Agent access disabled — AGENT_API_TOKEN is not configured" },
        { status: 503 }
      );
    }
    const a = Buffer.from(bearer);
    const b = Buffer.from(config.agentApiToken);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return null;
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (await getAdminUser()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
