import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listApplications } from "@/lib/admin-data";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await listApplications();

  return (
    <>
      <PageHeader title="Applications" eyebrow="Screening queue" />
      <section className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>Location</th>
              <th>Referrer</th>
              <th>Preferred window</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
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
                <td>{app.location || "-"}</td>
                <td>{app.referred_by || "-"}</td>
                <td>{app.preferred_window || "-"}</td>
                <td>{fmtDate(app.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
