import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ErrorBanner from "@/components/ErrorBanner";
import { listEvents } from "@/lib/admin-data";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const events = await listEvents();

  return (
    <>
      <PageHeader title="Events" eyebrow="Calendar">
        <Link href="/events/new" className="btn btn-gold">
          New event
        </Link>
      </PageHeader>
      <ErrorBanner error={error} />
      <section className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Tier</th>
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
                  <Link href={`/events/${event.id}`} className="font-medium text-ink hover:text-gold">
                    {event.title}
                  </Link>
                  {event.location_note && <p className="text-xs text-muted">{event.location_note}</p>}
                </td>
                <td>
                  <span className={`chip ${event.audience === "public" ? "chip-gold" : ""}`}>
                    {event.audience === "public" ? "Public guest" : "Member"}
                  </span>
                </td>
                <td>{event.event_type}</td>
                <td>
                  <StatusChip value={event.status} />
                </td>
                <td>{fmtDate(event.start_at)}</td>
                <td>{event.capacity || "∞"}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  Nothing on the calendar — create the first event.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
