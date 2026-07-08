import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import StripQuery from "./StripQuery";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { config } from "@core/config";
import { mintAgentTokenAction, revokeAgentTokenAction } from "@/lib/agent-actions";
import type { AgentTokenRow, AuditLogRow } from "@core/database.types";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const MCP_URL = () => `${config.adminUrl || "https://opencollective.app"}/api/mcp`;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; minted?: string; label?: string }>;
}) {
  const { error, minted, label } = await searchParams;
  const admin = (await getAdminUser())!;
  const supabase = getSupabaseAdmin();

  const [{ data: mineRaw }, { data: allRaw }, { data: activityRaw }] = await Promise.all([
    supabase
      .from("agent_tokens")
      .select("*")
      .eq("admin_id", admin.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_tokens")
      .select("*")
      .is("revoked_at", null)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("audit_logs")
      .select("*")
      .like("action", "agent.%")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const mine = (mineRaw as AgentTokenRow[]) || [];
  const allTokens = (allRaw as AgentTokenRow[]) || [];
  const activity = (activityRaw as AuditLogRow[]) || [];

  // Owner emails via map-join (embedded selects collapse types to never).
  const ownerIds = Array.from(new Set(allTokens.map((t) => t.admin_id)));
  const { data: ownersRaw } = ownerIds.length
    ? await supabase.from("users").select("id, email").in("id", ownerIds)
    : { data: [] };
  const ownerEmail = new Map(((ownersRaw as { id: string; email: string }[]) || []).map((u) => [u.id, u.email]));
  const all = allTokens.map((t) => ({ ...t, ownerEmail: ownerEmail.get(t.admin_id) || null }));

  const activeMine = mine.filter((t) => !t.revoked_at);
  const mcpUrl = MCP_URL();

  return (
    <>
      <StripQuery />
      <PageHeader title="Agents & MCP" eyebrow="Operator OS for machines">
        <span className={`chip ${config.agentApiToken ? "chip-green" : "chip-gold"}`}>
          {config.agentApiToken ? "endpoint live" : "system token unset"}
        </span>
      </PageHeader>
      <ErrorBanner error={error} />

      {minted && (
        <section className="panel mb-5 border-gold/40 p-5">
          <p className="label">Your new token{label ? ` — ${label}` : ""}</p>
          <p className="text-[13px] text-muted">
            Copy it now — it is shown once and stored only as a hash.
          </p>
          <code className="mt-3 block select-all break-all rounded-[10px] border border-white/12 bg-black/40 p-3 text-[13px] text-gold">
            {minted}
          </code>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Your tokens */}
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-4">
              <p className="label mb-0">Your tokens ({activeMine.length}/3 active)</p>
              <form action={mintAgentTokenAction} className="flex items-center gap-2">
                <input
                  name="label"
                  className="input max-w-[190px]"
                  placeholder="label, e.g. claude-code"
                  required
                  maxLength={40}
                />
                <button type="submit" className="btn btn-gold">
                  Mint token
                </button>
              </form>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Token</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted">
                      No tokens yet. Mint one and point your agent at the MCP endpoint.
                    </td>
                  </tr>
                )}
                {mine.map((t) => (
                  <tr key={t.id} className={t.revoked_at ? "opacity-45" : ""}>
                    <td className="font-medium text-ink">{t.label}</td>
                    <td>
                      <code className="text-[12px] text-muted">{t.prefix}…</code>
                    </td>
                    <td>{fmtDate(t.created_at)}</td>
                    <td>{t.last_used_at ? fmtDate(t.last_used_at) : "never"}</td>
                    <td className="text-right">
                      {t.revoked_at ? (
                        <span className="chip chip-red">revoked</span>
                      ) : (
                        <form action={revokeAgentTokenAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className="btn btn-red">
                            Revoke
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Team tokens (who is contributing what) */}
          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Active tokens across the team</p>
            <table className="table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Label</th>
                  <th>Token</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {all.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted">
                      Nobody has minted a token yet.
                    </td>
                  </tr>
                )}
                {all.map((t) => (
                  <tr key={t.id}>
                    <td>{t.ownerEmail || "—"}</td>
                    <td className="font-medium text-ink">{t.label}</td>
                    <td>
                      <code className="text-[12px] text-muted">{t.prefix}…</code>
                    </td>
                    <td>{t.last_used_at ? fmtDate(t.last_used_at) : "never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Agent activity */}
          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Agent activity</p>
            {activity.length === 0 ? (
              <p className="px-4 py-5 text-sm text-faint">
                No agent writes yet. Reads are not logged; every write lands here with the
                admin + token that performed it.
              </p>
            ) : (
              <ol className="divide-y divide-line">
                {activity.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <p className="text-[13px] text-ink">{a.summary || a.action}</p>
                    <p className="mt-0.5 text-[11px] text-faint">
                      {fmtDate(a.created_at)} · {a.actor_email || "system"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Install instructions */}
        <aside className="space-y-5">
          <section className="panel p-5">
            <p className="label">Endpoint</p>
            <code className="block select-all break-all rounded-[10px] border border-white/12 bg-black/40 p-3 text-[12px] text-gold">
              {mcpUrl}
            </code>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Tools: <code>kb_tree</code>, <code>kb_get</code>, <code>kb_search</code>,{" "}
              <code>kb_upsert</code>. Reads are free; writes are audited under your token.
            </p>
          </section>

          <section className="panel p-5">
            <p className="label">Claude Code</p>
            <code className="block select-all whitespace-pre-wrap break-all rounded-[10px] border border-white/12 bg-black/40 p-3 text-[11.5px] leading-relaxed text-muted">
              {`claude mcp add --transport http operator-os \\
  ${mcpUrl} \\
  --header "Authorization: Bearer osk_YOUR_TOKEN"`}
            </code>
            <p className="mt-2 text-[11.5px] text-faint">
              Then in a session: “use the operator-os tools to read the KB”.
            </p>
          </section>

          <section className="panel p-5">
            <p className="label">Codex / any MCP client</p>
            <code className="block select-all whitespace-pre-wrap break-all rounded-[10px] border border-white/12 bg-black/40 p-3 text-[11.5px] leading-relaxed text-muted">
              {`{
  "mcpServers": {
    "operator-os": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer osk_YOUR_TOKEN"
      }
    }
  }
}`}
            </code>
          </section>

          <section className="panel p-5">
            <p className="label">Plain REST</p>
            <code className="block select-all whitespace-pre-wrap break-all rounded-[10px] border border-white/12 bg-black/40 p-3 text-[11.5px] leading-relaxed text-muted">
              {`curl ${config.adminUrl || "https://opencollective.app"}/api/kb/tree \\
  -H "Authorization: Bearer osk_YOUR_TOKEN"`}
            </code>
            <p className="mt-2 text-[11.5px] text-faint">
              GET /api/kb/tree · /api/kb/search?q= · /api/kb/nodes/:id · POST /api/kb/nodes
            </p>
          </section>

          <section className="panel p-5">
            <p className="label">Suggested agent prompt</p>
            <p className="text-[12px] leading-relaxed text-muted">
              “You have the Collective Operator OS MCP (operator-os). The knowledge base is
              the source of truth for house SOPs, guest notes, and season plans. Read before
              answering; when asked to document something, save it with kb_upsert under the
              right folder. Keep member-visible docs free of internal notes.”
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
