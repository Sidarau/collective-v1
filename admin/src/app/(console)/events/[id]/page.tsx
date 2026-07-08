import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ErrorBanner from "@/components/ErrorBanner";
import { getSupabaseAdmin } from "@core/supabase";
import { config } from "@core/config";
import type { EventGuestRsvpRow, EventRow } from "@core/database.types";
import { deleteEventAction, inviteGuestToMemberAction } from "@/lib/content-actions";
import { fmtDate } from "@/lib/format";
import EventForm from "../EventForm";

export const dynamic = "force-dynamic";

export default async function EventEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = getSupabaseAdmin();
  const [{ data: event }, { data: gates }, { count: rsvps }, { data: guestRsvps }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("villas").select("id, name").neq("status", "archived").order("sort_order"),
    supabase.from("event_rsvps").select("id", { count: "exact", head: true }).eq("event_id", id),
    supabase
      .from("event_guest_rsvps")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!event) notFound();
  const row = event as EventRow;
  const guests = (guestRsvps as EventGuestRsvpRow[]) || [];
  const publicUrl = `${config.baseUrl.replace(/\/$/, "")}/events/${row.slug}`;

  return (
    <>
      <Link href="/events" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Events
      </Link>
      <PageHeader title={row.title} eyebrow="Event editor">
        <div className="flex items-center gap-2">
          <span className={`chip ${row.audience === "public" ? "chip-gold" : ""}`}>
            {row.audience === "public" ? "Public guest" : "Member-only"}
          </span>
          <span className="chip">{rsvps || 0} member RSVPs</span>
          {row.audience === "public" && <span className="chip">{guests.length} guest RSVPs</span>}
          <StatusChip value={row.status} />
        </div>
      </PageHeader>
      <ErrorBanner error={error} />

      <section className="panel p-5">
        <EventForm event={row} gates={gates || []} />
      </section>

      {row.audience === "public" && (
        <section className="panel mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="label">Public guest list</p>
              <p className="mt-1 text-[12px] text-muted">
                Share{" "}
                <a href={publicUrl} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                  {publicUrl}
                </a>
              </p>
            </div>
            <span className="chip chip-gold">{guests.filter((g) => g.status === "going").length} going</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Note</th>
                <th>Invited</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td>
                    <p className="font-medium text-ink">
                      {guest.first_name} {guest.last_name}
                    </p>
                    <p className="text-xs text-muted">{fmtDate(guest.created_at)}</p>
                  </td>
                  <td>
                    <p>{guest.email}</p>
                    <p className="text-xs text-muted">{guest.phone}</p>
                    {guest.instagram && <p className="text-xs text-muted">{guest.instagram}</p>}
                  </td>
                  <td>
                    <span className={`chip ${guest.status === "going" ? "chip-green" : "chip-gold"}`}>
                      {guest.status}
                    </span>
                  </td>
                  <td className="max-w-xs text-muted">{guest.note || "—"}</td>
                  <td>{guest.invited_at ? fmtDate(guest.invited_at) : "—"}</td>
                  <td className="text-right">
                    {guest.invited_user_id ? (
                      <a href={`/people/${guest.invited_user_id}`} className="btn">
                        View member
                      </a>
                    ) : (
                      <form action={inviteGuestToMemberAction}>
                        <input type="hidden" name="eventId" value={row.id} />
                        <input type="hidden" name="guestId" value={guest.id} />
                        <button type="submit" className="btn btn-gold">
                          Invite to portal
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {guests.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No guest RSVPs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel mt-5 flex items-center justify-between p-4">
        <p className="text-[12px] text-faint">
          Deleting removes the event and its RSVPs. Prefer status → cancelled to keep the record.
        </p>
        <form action={deleteEventAction}>
          <input type="hidden" name="id" value={row.id} />
          <button type="submit" className="btn btn-red">
            Delete event
          </button>
        </form>
      </section>
    </>
  );
}
