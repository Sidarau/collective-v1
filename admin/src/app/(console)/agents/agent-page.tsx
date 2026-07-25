import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import AgentChat, { type ChatMessage } from "@/components/AgentChat";

export const dynamic = "force-dynamic";

export type AgentName = "selene" | "collecta";

const AGENTS: Record<AgentName, { label: string; scope: string; blurb: string }> = {
  selene: {
    label: "Selene",
    scope: "owner",
    blurb: "Your owner-seat operator for the Collective.",
  },
  collecta: {
    label: "Collecta",
    scope: "assistant",
    blurb: "Don's assistant seat — read, prepare, notify.",
  },
};

export async function renderAgentPage(agent: AgentName) {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("agent_messages")
    .select("id, role, content, created_at")
    .eq("admin_id", admin.id)
    .eq("agent_name", agent)
    .order("created_at", { ascending: true })
    .limit(100);

  const meta = AGENTS[agent];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-neutral-500 mb-2">{meta.blurb}</p>
      <AgentChat
        agentName={agent}
        agentLabel={meta.label}
        agentScope={meta.scope}
        initialMessages={(data as ChatMessage[]) ?? []}
      />
    </div>
  );
}
