import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listApplications } from "@/lib/admin-data";
import { mapLatestCalls } from "@/lib/funnel-data";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const callTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default async function ApplicationsPage() {
  const applications = await listApplications();
  const calls = await mapLatestCalls(
    "application_id",
    applications.map((a) => a.id)
  );

  return (
    <>
      <PageHeader title="Applications" eyebrow="Member funnel">
        <p className="text-[12px] text-faint">
          Prospects arrive through Referral Links and book their own host call.
        </p>
      </PageHeader>
      <section className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>Host call</th>
              <th>Location</th>
              <th>Referrer</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const call = calls.get(app.id);
              return (
                <tr key={app.id}>
                  <td>
                    <Link href={`/applications/${app.id}`} className="font-medium text-ink hover:text-gold">
                      {app.first_name} {app.last_name}
                    </Link>
                    <p className="text-xs text-muted">{app.email}</p>
                  </td>
                  <td>
                    <StatusChip value={app.status} />
                  </td>
                  <td>
                    {call && call.status === "scheduled" ? (
                      <span className="chip chip-gold">{callTime(call.scheduled_at, call.timezone)}</span>
                    ) : call ? (
                      <StatusChip value={call.status} />
                    ) : (
                      <span className="text-faint">not booked</span>
                    )}
                  </td>
                  <td>{app.location || "-"}</td>
                  <td>{app.referred_by || "-"}</td>
                  <td>{fmtDate(app.created_at)}</td>
                </tr>
              );
            })}
            {applications.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No applications yet — share a member door from Referral Links.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
