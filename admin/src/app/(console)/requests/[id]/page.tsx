import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import Timeline from "@/components/Timeline";
import CrmPanel from "@/components/CrmPanel";
import ErrorBanner from "@/components/ErrorBanner";
import { getRequestDetail } from "@/lib/admin-data";
import { fmtDate, fmtMoney } from "@/lib/format";
import { requestTransitionAction, suggestAlternativeAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const detail = await getRequestDetail(id);
  if (!detail) notFound();
  const { booking, room, gate, lead, user, profile, timeline, payments, conflicts } = detail;
  const path = `/requests/${id}`;

  const personName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : lead
      ? `${lead.first_name} ${lead.last_name}`
      : user?.email || "Unknown";

  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86_400_000
    )
  );

  const showOps: { op: string; label: string; gold?: boolean; red?: boolean; money?: boolean; notify?: boolean }[] = [];
  if (booking.status === "requested" || booking.status === "inquiry") {
    showOps.push({ op: "approve", label: "Approve window", gold: true, notify: true });
    showOps.push({ op: "reject", label: "Decline", red: true, notify: true });
  }
  if (booking.status === "approved") {
    showOps.push({ op: "deposit", label: "Deposit received", gold: true, money: true });
    showOps.push({ op: "confirm", label: "Confirm", notify: true });
    showOps.push({ op: "cancel", label: "Cancel", red: true, notify: true });
  }
  if (booking.status === "deposit_paid") {
    showOps.push({ op: "paid", label: "Paid in full", gold: true, money: true });
    showOps.push({ op: "confirm", label: "Confirm", notify: true });
    showOps.push({ op: "cancel", label: "Cancel", red: true, notify: true });
  }
  if (booking.status === "paid") {
    showOps.push({ op: "confirm", label: "Confirm", gold: true, notify: true });
    showOps.push({ op: "cancel", label: "Cancel", red: true, notify: true });
  }
  if (booking.status === "confirmed") {
    showOps.push({ op: "complete", label: "Mark completed", gold: true });
    showOps.push({ op: "cancel", label: "Cancel", red: true, notify: true });
  }

  return (
    <>
      <Link href="/requests" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Stay requests
      </Link>
      <PageHeader title={`${personName} · ${fmtDate(booking.check_in)} → ${fmtDate(booking.check_out)}`} eyebrow="Window request">
        <StatusChip value={booking.status} />
      </PageHeader>
      <ErrorBanner error={error} />

      {conflicts.length > 0 && ["requested", "inquiry"].includes(booking.status) && (
        <div className="panel mb-4 border-red/40 px-4 py-3">
          <p className="text-[13px] font-semibold text-red">
            Conflict: {conflicts.length} committed window{conflicts.length > 1 ? "s" : ""} overlap this room
          </p>
          {conflicts.map((c) => (
            <p key={c.id} className="mt-1 text-[12px] text-muted">
              {fmtDate(c.check_in)} → {fmtDate(c.check_out)} · {c.status}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* The request */}
          <section className="panel p-5">
            <p className="label">The window</p>
            <dl className="kv mt-2">
              <div className="contents"><dt>Gate</dt><dd>{gate?.name || "—"}</dd></div>
              <div className="contents"><dt>Room</dt><dd>{room?.name || "—"}</dd></div>
              <div className="contents"><dt>Dates</dt><dd>{booking.check_in} → {booking.check_out} · {nights} night{nights > 1 ? "s" : ""}</dd></div>
              <div className="contents"><dt>Party</dt><dd>{booking.guests} guest{booking.guests > 1 ? "s" : ""}{booking.companion_name ? ` — with ${booking.companion_name}` : ""}</dd></div>
              <div className="contents"><dt>Member value</dt><dd>{fmtMoney(booking.total_price, booking.currency)}</dd></div>
              {booking.special_requests && (
                <div className="contents"><dt>Note from member</dt><dd className="whitespace-pre-wrap">{booking.special_requests}</dd></div>
              )}
              {booking.operator_notes && (
                <div className="contents"><dt>Operator notes</dt><dd className="whitespace-pre-wrap">{booking.operator_notes}</dd></div>
              )}
              <div className="contents"><dt>Requested</dt><dd>{fmtDate(booking.created_at)}</dd></div>
            </dl>
          </section>

          {/* The person */}
          <section className="panel p-5">
            <p className="label">The person</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">{personName}</p>
                <p className="text-[12.5px] text-muted">{user?.email || lead?.email}</p>
                {profile?.headline && <p className="mt-1 text-[12.5px] text-muted">{profile.headline}</p>}
                {(profile?.allergies || profile?.dietary || lead?.dietary_restrictions) && (
                  <p className="mt-1 text-[12.5px] text-gold">
                    Kitchen: {[profile?.allergies, profile?.dietary, lead?.dietary_restrictions].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {user && (
                <Link href={`/people/${user.id}`} className="btn">
                  Open person
                </Link>
              )}
            </div>
          </section>

          {/* Decisions */}
          {showOps.length > 0 && (
            <section className="panel p-5">
              <p className="label">Decide</p>
              <div className="space-y-3">
                {showOps.map((cfg) => (
                  <form key={cfg.op} action={requestTransitionAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={booking.id} />
                    <input type="hidden" name="op" value={cfg.op} />
                    {cfg.money && (
                      <input
                        name="amount"
                        type="number"
                        min={0}
                        placeholder="€ amount"
                        className="input max-w-[110px]"
                      />
                    )}
                    {cfg.money && (
                      <input name="method" placeholder="wire / cash / link" className="input max-w-[140px]" />
                    )}
                    <input name="note" placeholder="note (optional)" className="input max-w-[220px]" />
                    {cfg.notify && (
                      <label className="flex items-center gap-1.5 text-[12px] text-muted">
                        <input type="checkbox" name="notify" /> notify
                      </label>
                    )}
                    <button
                      type="submit"
                      className={`btn ${cfg.gold ? "btn-gold" : ""} ${cfg.red ? "btn-red" : ""}`}
                    >
                      {cfg.label}
                    </button>
                  </form>
                ))}
              </div>
            </section>
          )}

          {/* Alternative */}
          {["requested", "inquiry", "approved"].includes(booking.status) && (
            <section className="panel p-5">
              <p className="label">Suggest an alternative</p>
              <form action={suggestAlternativeAction} className="flex items-start gap-2">
                <input type="hidden" name="id" value={booking.id} />
                <textarea
                  name="message"
                  className="input"
                  placeholder="e.g. The house opens Aug 12–16 — same room, quieter week."
                />
                <button type="submit" className="btn shrink-0">
                  Send suggestion
                </button>
              </form>
            </section>
          )}

          {/* Money trail */}
          {payments.length > 0 && (
            <section className="panel overflow-hidden">
              <p className="label border-b border-line px-4 pb-3 pt-4">Payments</p>
              <table className="table">
                <thead>
                  <tr><th>Kind</th><th>Amount</th><th>Method</th><th>Reference</th><th>Received</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="capitalize">{p.kind}</td>
                      <td>{fmtMoney(p.amount, p.currency)}</td>
                      <td>{p.method || "—"}</td>
                      <td>{p.reference || "—"}</td>
                      <td>{fmtDate(p.received_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Activity */}
          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Timeline</p>
            <Timeline items={timeline} />
          </section>
        </div>

        <aside>
          <CrmPanel entityType="booking" entityId={booking.id} path={path} />
        </aside>
      </div>
    </>
  );
}
