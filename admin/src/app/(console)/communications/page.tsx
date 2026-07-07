import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listEmailMessages, listSuppressions } from "@/lib/admin-data";
import { getEmailMode } from "@core/email";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The outbox: every email attempt in one place. In log mode nothing is
 * delivered — entrance links stay revealable here and on entity timelines.
 */
export default async function CommunicationsPage() {
  const [messages, suppressions] = await Promise.all([
    listEmailMessages(100),
    listSuppressions(),
  ]);
  const mode = getEmailMode();

  return (
    <>
      <PageHeader title="Communications" eyebrow="Outbox · Resend">
        <span className={`chip ${mode === "send" ? "chip-green" : "chip-gold"}`}>
          {mode === "send" ? "delivery on" : "log mode — nothing is sent"}
        </span>
      </PageHeader>

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
              const meta = (m.meta || {}) as { magic_link?: string };
              return (
                <tr key={m.id}>
                  <td>{m.to_email}</td>
                  <td>{m.template || "—"}</td>
                  <td>{m.subject}</td>
                  <td>
                    <StatusChip value={m.status} />
                  </td>
                  <td>
                    {meta.magic_link ? (
                      <details className="reveal-link">
                        <summary>Reveal</summary>
                        <code>{meta.magic_link}</code>
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
