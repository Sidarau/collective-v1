import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import AgentChat, { type ChatMessage } from "@/components/AgentChat";

export const dynamic = "force-dynamic";

export default async function CollectaPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("agent_messages")
    .select("id, role, content, created_at")
    .eq("admin_id", admin.id)
    .eq("agent_name", "collecta")
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-neutral-500 mb-2">
        The Collective's operator — works with your access level. Onboard members,
        verify staff/vendor work, trigger invites and emails, draft KB updates.
      </p>
      <AgentChat
        agentName="collecta"
        agentLabel="Collecta"
        agentScope="your"
        initialMessages={(data as ChatMessage[]) ?? []}
      />
    </div>
  );
}
