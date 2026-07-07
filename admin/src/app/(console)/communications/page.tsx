import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ErrorBanner from "@/components/ErrorBanner";
import { listEmailMessages, listSuppressions } from "@/lib/admin-data";
import { listCampaigns } from "@/lib/funnel-data";
import { saveCampaignAction } from "@/lib/comms-actions";
import { getEmailMode } from "@core/email";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The outbox: every email attempt in one place, plus campaigns. In log mode
 * nothing is delivered — links stay revealable here and on entity timelines.
 */
export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [messages, suppressions, campaigns] = await Promise.all([
    listEmailMessages(100),
    listSuppressions(),
    listCampaigns(),
  ]);
  const mode = getEmailMode();

  return (
    <>
      <PageHeader title="Communications" eyebrow="Outbox · Campaigns · Resend">
        <span className={`chip ${mode === "send" ? "chip-green" : "chip-gold"}`}>
          {mode === "send" ? "delivery on" : "log mode — nothing is sent"}
        </span>
      </PageHeader>
      <ErrorBanner error={error} />

      <section className="panel mb-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Campaigns</h3>
          <form action={saveCampaignAction} className="flex items-center gap-2">
            <input name="name" required className="input w-64" placeholder="New campaign name" />
            <button type="submit" className="btn btn-gold">
              Draft campaign
            </button>
          </form>
        </div>
        {campaigns.length === 0 ? (
          <p className="px-4 py-4 text-sm text-faint">
            No campaigns yet. Draft one, pick the audience, review, send — every recipient goes
            through the suppression-checked outbox.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/communications/campaigns/${c.id}`}
                      className="font-medium text-ink hover:text-gold"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.subject || "—"}</td>
                  <td>
                    <StatusChip value={c.status} />
                  </td>
                  <td>{c.status === "sent" ? `${c.sent_count}/${c.total_recipients}` : "—"}</td>
                  <td>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>To</th>
              <th>Template</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Link</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No email activity yet. Approvals, invites, and status changes will land here.
                </td>
              </tr>
            )}
            {messages.map((m) => {
              const meta = (m.meta || {}) as {
                magic_link?: string;
                scheduling_url?: string;
                calendar_url?: string;
              };
              const link = meta.magic_link || meta.scheduling_url || meta.calendar_url;
              return (
                <tr key={m.id}>
                  <td>{m.to_email}</td>
                  <td>{m.template || "—"}</td>
                  <td>{m.subject}</td>
                  <td>
                    <StatusChip value={m.status} />
                  </td>
                  <td>
                    {link ? (
                      <details className="reveal-link">
                        <summary>Reveal</summary>
                        <code>{link}</code>
                      </details>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{fmtDate(m.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel mt-4 overflow-hidden">
        <p className="label border-b border-line px-4 pb-3 pt-4">
          Suppression list ({suppressions.length})
        </p>
        {suppressions.length === 0 ? (
          <p className="px-4 py-4 text-sm text-faint">
            Nobody is suppressed. Bounces, complaints, and manual suppressions will appear here
            and block all future sends to that address.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Reason</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {suppressions.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td className="capitalize">{s.reason}</td>
                  <td>{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
