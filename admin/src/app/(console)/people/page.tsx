import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listPeople } from "@/lib/admin-data";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const people = await listPeople();

  return (
    <>
      <PageHeader title="People" eyebrow="Native CRM" />
      <section className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Profile</th>
              <th>Lead source</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>
                  <Link href={`/people/${person.id}`} className="font-medium text-ink hover:text-gold">
                    {person.profile
                      ? `${person.profile.first_name} ${person.profile.last_name}`.trim()
                      : person.lead
                        ? `${person.lead.first_name} ${person.lead.last_name}`.trim()
                        : person.email}
                  </Link>
                  <p className="text-xs text-muted">{person.email}</p>
                </td>
                <td>
                  <StatusChip value={person.role} />
                </td>
                <td>{person.profile?.headline || "-"}</td>
                <td>{person.lead?.source || "-"}</td>
                <td>{fmtDate(person.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
