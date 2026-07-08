import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { fmtDate, fmtMoney } from "@/lib/format";
import { getDashboardData, listOpenFollowUps } from "@/lib/admin-data";
import { listCalls } from "@/lib/funnel-data";
import { setFollowUpStatusAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

const callTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const oneHourAgoIso = () => new Date(new Date().getTime() - 60 * 60_000).toISOString();

export default async function DashboardPage() {
  const [data, followUps, calls] = await Promise.all([
    getDashboardData(),
    listOpenFollowUps(),
    listCalls({
      from: oneHourAgoIso(),
      statuses: ["scheduled"],
      limit: 5,
    }),
  ]);

  return (
    <>
      <PageHeader title="Command center" eyebrow="Today" />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="panel p-4">
            <p className="text-xs text-muted">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{metric.value}</p>
          </div>
        ))}
      </section>

      {calls.length > 0 && (
        <section className="panel mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Next host calls</h3>
            <Link href="/schedule" className="text-xs text-muted hover:text-ink">
              Full schedule →
            </Link>
          </div>
          <div className="divide-y divide-line">
            {calls.map((call) => (
              <div key={call.id} className="flex items-center gap-4 px-4 py-2.5">
                <p className="w-44 shrink-0 text-[13px] font-semibold text-gold">
                  {callTime(call.scheduled_at, call.timezone)}
                </p>
                <p className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {call.prospect_name}
                  <span className="text-muted"> · {call.prospect_email}</span>
                </p>
                <span className="chip">{call.kind}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">Upcoming and open stay requests</h3>
            <Link href="/requests" className="text-xs text-muted hover:text-ink">
              All requests →
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Window</th>
                <th>Status</th>
                <th>Guests</th>
                <th>Value</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link href={`/requests/${request.id}`} className="text-ink hover:text-gold">
                      {fmtDate(request.check_in)} - {fmtDate(request.check_out)}
                    </Link>
                  </td>
                  <td>
                    <StatusChip value={request.status} />
                  </td>
                  <td>{request.guests}</td>
                  <td>{fmtMoney(request.total_price, request.currency)}</td>
                  <td>{fmtDate(request.created_at)}</td>
                </tr>
              ))}
              {data.upcomingRequests.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted">
                    No upcoming requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel self-start overflow-hidden">
          <p className="label border-b border-line px-4 pb-3 pt-4">
            Follow-ups ({followUps.length})
          </p>
          {followUps.length === 0 ? (
            <p className="px-4 py-4 text-sm text-faint">Nothing pending. Set follow-ups from any record.</p>
          ) : (
            <div className="divide-y divide-line">
              {followUps.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-ink">{f.title}</p>
                    <p className="text-[11px] text-faint">
                      {f.due_at ? `due ${fmtDate(f.due_at)}` : "no date"}
                      {f.owner_email ? ` · ${f.owner_email}` : ""}
                    </p>
                  </div>
                  <form action={setFollowUpStatusAction}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="status" value="done" />
                    <input type="hidden" name="path" value="/" />
                    <button type="submit" className="btn">
                      Done
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
