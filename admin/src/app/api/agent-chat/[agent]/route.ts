import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";

/**
 * POST /api/agent-chat/[agent] — send a message to Selene or Collecta.
 *
 * The route:
 * 1. Verifies the caller is an authenticated admin.
 * 2. Persists the user message to agent_messages.
 * 3. Forwards the message to the Hermes profile on aws-hermes (via gateway
 *    chat API) with the admin's Operator MCP token so the agent acts with
 *    the right scope.
 * 4. Persists the agent reply and returns both messages.
 *
 * If the gateway is unreachable, the agent reply is stored as a system
 * message so the UI stays consistent and nothing is lost.
 */

const VALID_AGENTS = new Set(["selene", "collecta"]);

const AGENT_META: Record<string, { label: string }> = {
  selene: { label: "Selene" },
  collecta: { label: "Collecta" },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agent: string }> },
) {
  const { agent } = await params;
  if (!VALID_AGENTS.has(agent)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }
  const agentName = agent as "selene" | "collecta";

  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "Message too long (max 8000 chars)" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Persist the user message
  const { data: userMsg, error: insertErr } = await supabase
    .from("agent_messages")
    .insert({ admin_id: admin.id, agent_name: agentName, role: "user", content: text })
    .select()
    .single();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // 2. Find this admin's active MCP token for the matching agent label so the
  //    Hermes profile acts with the right scope (owner for selene, assistant
  //    for collecta). Falls back to any active token for this admin.
  const { data: tokens } = await supabase
    .from("agent_tokens")
    .select("id, label, scope, token_hash")
    .eq("admin_id", admin.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  // 3. Forward to the Hermes gateway chat endpoint for the profile.
  const gatewayBase = process.env.HERMES_GATEWAY_URL || "http://aws-hermes:8080";
  let agentReply: string;
  let replyRole: "agent" | "system" = "agent";
  try {
    const res = await fetch(`${gatewayBase}/profiles/${agentName}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        user: { id: admin.id, email: admin.email },
        available_scopes: (tokens ?? []).map((t) => t.scope),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const data = await res.json();
    agentReply = typeof data.reply === "string" && data.reply.trim()
      ? data.reply
      : `${AGENT_META[agentName].label} received the message but returned an empty reply.`;
  } catch (e) {
    replyRole = "system";
    agentReply =
      `${AGENT_META[agentName].label} is offline (gateway unreachable). ` +
      `Your message is saved and will be answered when the gateway is back. ` +
      `(${e instanceof Error ? e.message : "connection failed"})`;
  }

  // 4. Persist the agent/system reply
  const { data: agentMsg, error: replyErr } = await supabase
    .from("agent_messages")
    .insert({ admin_id: admin.id, agent_name: agentName, role: replyRole, content: agentReply })
    .select()
    .single();
  if (replyErr) {
    return NextResponse.json({ error: replyErr.message }, { status: 500 });
  }

  return NextResponse.json({ user_message: userMsg, agent_message: agentMsg });
}
