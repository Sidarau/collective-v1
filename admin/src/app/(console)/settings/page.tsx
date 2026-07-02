import PageHeader from "@/components/PageHeader";
import { config } from "@core/config";
import { getEmailMode } from "@core/email";

export const dynamic = "force-dynamic";

function yes(value: string) {
  return value ? "Configured" : "Missing";
}

export default function SettingsPage() {
  const mode = getEmailMode();
  const rows = [
    [
      "Email mode",
      mode === "send"
        ? "SEND — outbound email is live"
        : "LOG — every email is recorded in the outbox but nothing is delivered. Set EMAIL_MODE=send to go live (Alex decision).",
    ],
    ["Base URL", config.baseUrl],
    ["Admin URL", config.adminUrl || "Not set"],
    ["Supabase URL", yes(config.supabaseUrl)],
    ["Supabase service key", yes(config.supabaseServiceKey)],
    ["Resend API key", yes(config.resendApiKey)],
    ["Resend from email", config.resendFromEmail],
    ["Admin email", config.adminEmail || "Not set"],
    ["HubSpot token", config.hubspotToken ? "Configured but optional for v1" : "Deferred"],
  ];

  return (
    <>
      <PageHeader title="Settings" eyebrow="Launch readiness" />
      <section className="panel overflow-hidden">
        <table className="table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th className="w-64">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
