import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import StripQuery from "@/components/StripQuery";
import { getAdminUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { config } from "@core/config";
import {
  mintAgentTokenAction,
  mintCalendarSetupLinkAction,
  revokeAgentTokenAction,
  updateAgentCalendarGrantsAction,
  updateConnectedOperatorCalendarsAction,
} from "@/lib/agent-actions";
import type {
  AgentCalendarGrantRow,
  AgentTokenRow,
  AuditLogRow,
} from "@core/database.types";
import { fmtDate } from "@/lib/format";
import { listAllGoogleSources, listGoogleSources } from "@core/google-calendar";

export const dynamic = "force-dynamic";

const MCP_URL = () => `${config.adminUrl || "https://opencollective.app"}/api/mcp`;

export default async function AgentsPage({
  searchParams,
}: {
    searchParams: Promise<{
      error?: string;
      minted?: string;
      label?: string;
      calendarSetup?: string;
      target?: string;
    }>;
}) {
  const { error, minted, label, calendarSetup, target } = await searchParams;
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
  const calendarSources =
    admin.role === "admin" ? await listAllGoogleSources() : await listGoogleSources(admin.id);
  const { data: operatorUsersRaw } = await supabase
    .from("users")
    .select("id, email, role")
    .in("role", ["admin", "operator"])
    .order("email");
  const operatorUsers =
    ((operatorUsersRaw as { id: string; email: string; role: string }[]) || []).filter(
      (user) => admin.role === "admin" || user.id === admin.id
    );
  const { data: grantsRaw } = activeMine.length
    ? await supabase
        .from("agent_calendar_grants")
        .select("*")
        .in("agent_token_id", activeMine.map((token) => token.id))
    : { data: [] };
  const grants = (grantsRaw as AgentCalendarGrantRow[]) || [];
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

      {calendarSetup && (
        <section className="panel mb-5 border-gold/40 p-5">
          <p className="label">One-time calendar link{target ? ` — ${target}` : ""}</p>
          <p className="text-[13px] text-muted">
            Send this link privately. It expires in 48 hours and works once.
          </p>
          <code className="mt-3 block select-all break-all rounded-[10px] border border-white/12 bg-black/40 p-3 text-[12px] text-gold">
            {calendarSetup}
          </code>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="panel p-5">
            <p className="label">One-click Google setup</p>
            <p className="text-[12.5px] leading-relaxed text-muted">
              Prepare a private link. The recipient taps it, chooses their Google account,
              presses Allow, and sees “Calendar connected.” No console password or setup screen.
            </p>
            <form action={mintCalendarSetupLinkAction} className="mt-3 flex flex-wrap gap-2">
              <select name="targetAdminId" className="input min-w-[240px] flex-1">
                {operatorUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}{user.id === admin.id ? " (you)" : ""}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-gold">
                Create setup link
              </button>
            </form>
          </section>

          {calendarSources.length > 0 ? (
            <section className="panel overflow-hidden">
              <div className="border-b border-line px-4 pb-3 pt-4">
                <p className="label mb-1">Connected operator calendars</p>
                <p className="text-[12px] text-muted">
                  Choose which calendars participate in availability and may be granted to Selene.
                </p>
              </div>
              {Array.from(new Set(calendarSources.map((source) => source.adminId))).map(
                (ownerId) => {
                  const sources = calendarSources.filter((source) => source.adminId === ownerId);
                  return (
                    <form
                      key={ownerId}
                      action={updateConnectedOperatorCalendarsAction}
                      className="space-y-3 border-b border-line px-4 py-4 last:border-b-0"
                    >
                      <input type="hidden" name="targetAdminId" value={ownerId} />
                      <p className="text-[13px] font-medium text-ink">
                        {sources[0]?.googleEmail || ownerId}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sources.map((source) => (
                          <label
                            key={source.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-base px-3 py-2 text-[12px] text-muted"
                          >
                            <input
                              type="checkbox"
                              name="calendarSourceId"
                              value={source.id}
                              defaultChecked={source.selected}
                              className="accent-[#e0bd73]"
                            />
                            {source.summary}
                          </label>
                        ))}
                      </div>
                      <button type="submit" className="btn">
                        Save calendars
                      </button>
                    </form>
                  );
                }
              )}
            </section>
          ) : null}

          {/* Your tokens */}
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-4">
              <p className="label mb-0">Your tokens ({activeMine.length}/3 active)</p>
              <form action={mintAgentTokenAction} className="flex flex-wrap items-center gap-2">
                <input
                  name="label"
                  className="input max-w-[190px]"
                  placeholder="label, e.g. claude-code"
                  required
                  maxLength={40}
                />
                <select name="scope" className="input max-w-[150px]" defaultValue="assistant">
                  <option value="assistant">Assistant</option>
                  <option value="owner">Owner agent</option>
                  <option value="staff">Staff</option>
                  <option value="member">Member</option>
                </select>
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
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted">
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
                    <td>
                      <span className="chip">{t.scope || "owner"}</span>
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

          <section className="panel overflow-hidden">
            <div className="border-b border-line px-4 pb-3 pt-4">
              <p className="label mb-1">Calendar access</p>
              <p className="text-[12px] text-muted">
                Choose exactly which calendars each assistant can read. Calendar changes are
                sent to Schedule for your approval.
              </p>
            </div>
            {activeMine.length === 0 ? (
              <p className="px-4 py-5 text-sm text-faint">Mint an assistant token first.</p>
            ) : calendarSources.length === 0 ? (
              <p className="px-4 py-5 text-sm text-faint">
                Connect Google Calendar on the Schedule page first.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {activeMine.map((token) => {
                  const granted = new Set(
                    grants
                      .filter((grant) => grant.agent_token_id === token.id && grant.can_read)
                      .map((grant) => grant.source_id)
                  );
                  return (
                    <form
                      key={token.id}
                      action={updateAgentCalendarGrantsAction}
                      className="space-y-3 px-4 py-4"
                    >
                      <input type="hidden" name="tokenId" value={token.id} />
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-ink">{token.label}</p>
                        <span className="chip">{token.scope || "owner"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {calendarSources
                          .filter((source) => source.selected)
                          .map((source) => (
                            <label
                              key={source.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-base px-3 py-2 text-[12px] text-muted"
                            >
                              <input
                                type="checkbox"
                                name="calendarSourceId"
                                value={source.id}
                                defaultChecked={granted.has(source.id)}
                                className="accent-[#e0bd73]"
                              />
                              {source.summary}
                            </label>
                          ))}
                      </div>
                      <button type="submit" className="btn btn-gold">
                        Save access
                      </button>
                    </form>
                  );
                })}
              </div>
            )}
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
                  <th>Role</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {all.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted">
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
                    <td>{t.scope || "owner"}</td>
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
              Read: <code>kb_tree</code> · <code>kb_get</code> · <code>kb_search</code> ·{" "}
              <code>leads_search</code> · <code>operations_report</code> ·{" "}
              <code>referral_link_list</code> · <code>closure_list</code>
              <br />
              Calendar: <code>calendar_list</code> · <code>calendar_events</code> ·{" "}
              <code>calendar_event_create</code> · <code>calendar_event_update</code> ·{" "}
              <code>calendar_event_cancel</code> · <code>calendar_action_status</code>
              <br />
              Assistant tokens are the right choice for Selene. They see only granted calendars;
              every write request is attributable and high-risk changes require your approval.
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
