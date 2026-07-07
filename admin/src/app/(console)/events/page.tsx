import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listEvents } from "@/lib/admin-data";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await listEvents();

  return (
    <>
      <PageHeader title="Events" eyebrow="Calendar" />
      <section className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Type</th>
              <th>Status</th>
              <th>Starts</th>
              <th>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  <p className="font-medium text-ink">{event.title}</p>
                  <p className="text-xs text-muted">{event.location_note || "-"}</p>
                </td>
                <td>{event.event_type}</td>
                <td>
                  <StatusChip value={event.status} />
                </td>
                <td>{fmtDate(event.start_at)}</td>
                <td>{event.capacity || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
