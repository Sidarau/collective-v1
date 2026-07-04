import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ErrorBanner from "@/components/ErrorBanner";
import { getSupabaseAdmin } from "@core/supabase";
import type { EventRow } from "@core/database.types";
import { deleteEventAction } from "@/lib/content-actions";
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
  const [{ data: event }, { data: gates }, { count: rsvps }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("villas").select("id, name").neq("status", "archived").order("sort_order"),
    supabase.from("event_rsvps").select("id", { count: "exact", head: true }).eq("event_id", id),
  ]);
  if (!event) notFound();
  const row = event as EventRow;

  return (
    <>
      <Link href="/events" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Events
      </Link>
      <PageHeader title={row.title} eyebrow="Event editor">
        <div className="flex items-center gap-2">
          <span className="chip">{rsvps || 0} RSVPs</span>
          <StatusChip value={row.status} />
        </div>
      </PageHeader>
      <ErrorBanner error={error} />

      <section className="panel p-5">
        <EventForm event={row} gates={gates || []} />
      </section>

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
