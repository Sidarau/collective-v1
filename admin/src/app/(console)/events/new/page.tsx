import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { getSupabaseAdmin } from "@core/supabase";
import EventForm from "../EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { data: gates } = await getSupabaseAdmin()
    .from("villas")
    .select("id, name")
    .neq("status", "archived")
    .order("sort_order");

  return (
    <>
      <Link href="/events" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Events
      </Link>
      <PageHeader title="New event" eyebrow="Calendar" />
      <ErrorBanner error={error} />
      <section className="panel p-5">
        <EventForm event={null} gates={gates || []} />
      </section>
    </>
  );
}
