import Image from "next/image";
import Link from "next/link";
import { fetchContentBlock, fetchPublicEvents } from "@/lib/data";
import { fmtGateDayTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const HERO =
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2400&auto=format&fit=crop";

/**
 * Landing: deliberately silent. One image, the mark, one action.
 * Copy is operator-editable (admin console → Content → landing.hero).
 */
export default async function Landing() {
  const [hero, publicEvents] = await Promise.all([
    fetchContentBlock("landing.hero"),
    fetchPublicEvents(3),
  ]);

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image src={HERO} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 scrim-full" />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-between px-6 py-14">
        <div />

        <div className="stagger flex flex-col items-center text-center">
          <h1 className="wordmark text-2xl text-ink sm:text-3xl">Collective</h1>
          <p className="muted mt-6 max-w-xs text-[15px] leading-relaxed">
            {hero || "A private circle around the world's quiet places."}
            <br />
            Membership is by referral.
          </p>
          <Link
            href="/login"
            className="btn-champagne tap mt-10 inline-flex h-[52px] items-center px-10 text-[15px]"
          >
            Enter
          </Link>
          {publicEvents.length > 0 && (
            <section className="mt-7 w-full max-w-sm">
              <p className="eyebrow mb-3">Public events</p>
              <div className="space-y-2">
                {publicEvents.map((event) => (
                  <Link key={event.id} href={`/events/${event.slug}`} className="glass-flat tap block p-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-ink">{event.title}</p>
                        <p className="muted mt-1 text-[12px]">
                          {fmtGateDayTime(event.start_at)}
                          {event.villas?.name ? ` · ${event.villas.name}` : ""}
                        </p>
                      </div>
                      <span className="chip chip-gold">RSVP</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.18em]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <span className="faint">Ibiza · Est. 2026</span>
          <Link href="/terms" className="faint hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="faint hover:text-ink">
            Privacy
          </Link>
        </div>
      </div>
    </main>
  );
}
