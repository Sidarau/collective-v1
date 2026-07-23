import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GateGallery } from "@/components/GateGallery";
import { fetchGateBySlug, fetchPresence, fetchUpcomingEvents, fetchProfileByUserId } from "@/lib/data";
import { GATE_TZ, fmtGateWeekday } from "@/lib/datetime";
import { titleCaseName } from "@core/names";

export const dynamic = "force-dynamic";

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: GATE_TZ, month: "short", day: "numeric" }).format(new Date(`${iso}T12:00:00Z`));

export default async function GateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gate = await fetchGateBySlug(slug);
  if (!gate || gate.status === "archived") notFound();

  if (gate.status === "coming_soon") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <span className="chip chip-gold">Coming soon</span>
        <h1 className="display mt-4 text-[32px] text-ink">{gate.name}</h1>
        <p className="muted mt-2 text-[14px]">{gate.region || gate.location}</p>
        <Link href="/app/gates" className="btn-glass tap mt-8 inline-flex h-11 items-center px-6 text-[13px]">
          Back to Gates
        </Link>
      </div>
    );
  }

  const today = new Date();
  const horizon = new Date(today.getTime() + 60 * 86400_000);
  const [presence, allEvents] = await Promise.all([
    fetchPresence(gate.id, today.toISOString().slice(0, 10), horizon.toISOString().slice(0, 10)),
    fetchUpcomingEvents(10),
  ]);
  const gateEvents = allEvents.filter((e) => e.villa_id === gate.id).slice(0, 4);

  const presentNames = await Promise.all(
    presence.slice(0, 6).map(async (p) => {
      if (!p.users) return null;
      const profile = await fetchProfileByUserId(p.users.id);
      return profile
        ? { name: `${titleCaseName(profile.first_name)} ${profile.last_name.charAt(0).toUpperCase()}.`, window: `${fmtDay(p.check_in)} – ${fmtDay(p.check_out)}` }
        : null;
    })
  );
  const arrivals = presentNames.filter(Boolean) as { name: string; window: string }[];

  return (
    <div className="pb-8">
      {/* Hero */}
      <header className="relative -mb-8 h-[46vh] min-h-[340px] overflow-hidden">
        {gate.hero_image && (
          <>
            <Image src={gate.hero_image} alt={gate.name} fill priority sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
            <div className="absolute inset-0 scrim-b" />
          </>
        )}
        <Link
          href="/app/gates"
          className="btn-glass tap absolute left-5 top-14 flex h-10 w-10 items-center justify-center text-[16px]"
          aria-label="Back"
        >
          ‹
        </Link>
        <div className="absolute inset-x-0 bottom-10 px-5">
          <p className="eyebrow reveal">{gate.region || gate.location}</p>
          <h1 className="display reveal mt-1 text-[38px] leading-none text-ink">{gate.name}</h1>
          <p className="muted reveal mt-2 text-[14px]">{gate.tagline}</p>
        </div>
      </header>

      <div className="stagger relative space-y-4 px-5">
        {/* Story */}
        {gate.story && (
          <section className="glass p-6">
            <p className="eyebrow">The place</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{gate.story}</p>
            {gate.amenities.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {gate.amenities.map((a) => (
                  <span key={a} className="chip">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        <GateGallery gateName={gate.name} heroImage={gate.hero_image} images={gate.images} />

        {/* Rooms */}
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="eyebrow">Rooms</h2>
            <p className="faint text-[12px]">Each hosts two</p>
          </div>
          <div className="space-y-3">
            {gate.rooms
              .sort((a, b) => b.base_price_per_night - a.base_price_per_night)
              .map((room) => (
                <Link
                  key={room.id}
                  href={`/app/gates/${gate.slug}/request?room=${room.slug}`}
                  className="glass tap flex gap-4 overflow-hidden p-3"
                >
                  <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl">
                    {room.images[0] ? (
                      <Image src={room.images[0]} alt={room.name} fill sizes="112px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center border border-white/10 bg-[radial-gradient(circle_at_top,rgba(228,190,109,0.16),rgba(255,255,255,0.04)_62%)] px-3 text-center">
                        <span className="faint text-[9px] font-semibold uppercase tracking-[0.18em]">
                          Photo coming soon
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <p className="text-[16px] font-semibold text-ink">{room.name}</p>
                    <p className="muted mt-0.5 text-[13px]">
                      {room.bed_type || "King"} · {room.max_guests} guests
                    </p>
                    <p className="mt-1 text-[13px] text-champagne">Member window</p>
                  </div>
                  <span className="muted self-center pr-1">›</span>
                </Link>
              ))}
          </div>
        </section>

        {/* Who's around */}
        {arrivals.length > 0 && (
          <section className="glass p-5">
            <p className="eyebrow">At the Gate</p>
            <div className="mt-3 space-y-2">
              {arrivals.map((a, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-[14px] font-medium text-ink">{a.name}</p>
                  <p className="muted text-[12px]">{a.window}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Events at this gate */}
        {gateEvents.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3 px-1">Happening here</h2>
            <div className="space-y-3">
              {gateEvents.map((ev) => (
                <Link key={ev.id} href={`/app/calendar?event=${ev.slug}`} className="glass-flat tap flex items-center justify-between p-4">
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{ev.title}</p>
                    <p className="muted mt-0.5 text-[12px]">
                      {fmtGateWeekday(ev.start_at)}
                    </p>
                  </div>
                  <span className="chip chip-gold">{ev.event_rsvps.filter((r) => r.status === "going").length} going</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Fixed request CTA riding above the tab bar */}
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-5"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
      >
        <Link
          href={`/app/gates/${gate.slug}/request`}
          className="btn-champagne tap pointer-events-auto inline-flex h-[52px] items-center px-10 text-[15px]"
        >
          Request a window
        </Link>
      </div>
      <div className="h-16" />
    </div>
  );
}
