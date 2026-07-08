import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, fetchPublicEventBySlug } from "@/lib/data";
import { fmtGateDayTime } from "@/lib/datetime";
import GuestRsvpForm from "./GuestRsvpForm";

export const dynamic = "force-dynamic";

const FALLBACK =
  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=2200&auto=format&fit=crop";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await fetchPublicEventBySlug(slug);
  if (!event) notFound();

  const [{ count: guestCount }, { count: memberCount }] = await Promise.all([
    db()
      .from("event_guest_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "going"),
    db()
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "going"),
  ]);

  const going = (guestCount || 0) + (memberCount || 0);

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image
        src={event.image || FALLBACK}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 scrim-full" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-12">
        <Link href="/" className="wordmark reveal text-center text-sm text-ink">
          Collective
        </Link>

        <section className="reveal mt-auto" style={{ animationDelay: "0.08s" }}>
          <p className="eyebrow">Guest list</p>
          <h1 className="display mt-3 text-[38px] leading-[1.02] text-ink">{event.title}</h1>
          <p className="muted mt-3 text-[14px] leading-relaxed">
            {fmtGateDayTime(event.start_at)}
            {event.villas?.name ? ` · ${event.villas.name}` : ""}
            {event.location_note ? ` · ${event.location_note}` : ""}
          </p>
          {event.description && (
            <p className="mt-5 text-[15px] leading-relaxed text-ink/85">{event.description}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="chip chip-gold">Public event</span>
            <span className="chip">{going} going</span>
            {event.capacity ? <span className="chip">{event.capacity} visible spots</span> : null}
          </div>
        </section>

        <section className="glass-strong reveal mt-8 p-6" style={{ animationDelay: "0.16s" }}>
          <p className="eyebrow mb-4">RSVP</p>
          <GuestRsvpForm eventId={event.id} />
        </section>
      </div>
    </main>
  );
}
