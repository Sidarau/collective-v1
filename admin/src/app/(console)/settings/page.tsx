import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { config } from "@core/config";
import { getEmailMode } from "@core/email";
import { NOTIFICATION_TOGGLES, isToggleEnabled } from "@core/settings";
import { toggleNotificationAction } from "@/lib/settings-actions";

export const dynamic = "force-dynamic";

function yes(value: string) {
  return value ? "Configured" : "Missing";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const mode = getEmailMode();
  const toggles = await Promise.all(
    NOTIFICATION_TOGGLES.map(async (t) => ({ ...t, enabled: await isToggleEnabled(t.key) }))
  );

  const rows = [
    ["Base URL", config.baseUrl],
    ["Admin URL", config.adminUrl || "Not set"],
    ["Supabase URL", yes(config.supabaseUrl)],
    ["Supabase service key", yes(config.supabaseServiceKey)],
    ["Resend API key", yes(config.resendApiKey)],
    ["Resend from email", config.resendFromEmail],
    ["Admin email", config.adminEmail || "Not set"],
    [
      "Agent API token",
      config.agentApiToken
        ? "Configured — agents can use the KB REST + MCP endpoints"
        : "Not set — KB agent endpoints are disabled (set AGENT_API_TOKEN)",
    ],
  ];

  return (
    <>
      <PageHeader title="Settings" eyebrow="Launch readiness" />
      <ErrorBanner error={error} />

      <section
        className={`panel border p-4 ${mode === "send" ? "border-green/40" : "border-gold/40"}`}
      >
        <p className="text-sm font-semibold text-ink">
          Email mode: <span className={mode === "send" ? "text-green" : "text-gold"}>{mode.toUpperCase()}</span>
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {mode === "send"
            ? "Outbound email is live via Resend. Every send is still suppression-checked and logged in the outbox."
            : "Every email is recorded in the outbox but nothing is delivered. Set EMAIL_MODE=send on Vercel to go live (Alex's call). Magic links and scheduling links always appear in record timelines, so every flow is testable."}
        </p>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <section className="panel overflow-hidden">
          <p className="label border-b border-line px-4 pb-3 pt-4">Notifications</p>
          <div className="divide-y divide-line">
            {toggles.map((toggle) => (
              <div key={toggle.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-ink">{toggle.label}</p>
                  <p className="text-[11px] text-faint">{toggle.description}</p>
                </div>
                <form action={toggleNotificationAction}>
                  <input type="hidden" name="key" value={toggle.key} />
                  <input type="hidden" name="enabled" value={toggle.enabled ? "false" : "true"} />
                  <button
                    type="submit"
                    className={`btn ${toggle.enabled ? "btn-gold" : ""}`}
                    title={toggle.enabled ? "Click to disable" : "Click to enable"}
                  >
                    {toggle.enabled ? "On" : "Off"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="panel self-start overflow-hidden">
          <p className="label border-b border-line px-4 pb-3 pt-4">Environment</p>
          <table className="table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th className="w-56">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
