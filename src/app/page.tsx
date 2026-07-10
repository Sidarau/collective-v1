import Image from "next/image";
import Link from "next/link";
import { fetchContentBlock, fetchPublicEvents } from "@/lib/data";
import { fmtGateDayTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const HERO =
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2400&auto=format&fit=crop";

const BELIEFS = [
  "Growth happens faster when ambitious people are surrounded by individuals who challenge, expand and elevate their thinking.",
  "Business connections are built through trust, shared values and real presence — not through transactional networking.",
  "Extraordinary environments become catalysts for extraordinary decisions.",
];

const PILLARS = [
  {
    title: "The Network",
    body: "The right people accelerate growth. Open Collective creates proximity to entrepreneurs, thinkers and leaders who expand what members believe is possible.",
  },
  {
    title: "The Growth Layer",
    body: "Where people spend time influences how they think, decide and create. We curate environments that support clarity, ambition and elevated living.",
  },
  {
    title: "The Estate Access",
    body: "Every member, location and gathering is selected with intention. The network grows only when the standard can be protected.",
  },
];

const MEMBERSHIP = [
  "A curated circle of entrepreneurs, investors, creators and visionaries who value trust, growth and meaningful relationships.",
  "Private conversations, shared perspectives and high-level proximity that support personal development, entrepreneurial clarity and new opportunities.",
  "Access to selected private villas and curated environments around the world — designed for presence, connection, focus and elevated community moments.",
];

/**
 * Landing: a silent hero (the mark, one action), then the manifesto —
 * Don's prototype copy set in the house style. No application form here;
 * entrance stays behind the door.
 */
export default async function Landing() {
  const [hero, publicEvents] = await Promise.all([
    fetchContentBlock("landing.hero"),
    fetchPublicEvents(3),
  ]);

  return (
    <main className="relative">
      {/* ——— Hero ——— */}
      <section className="relative min-h-dvh overflow-hidden">
        <Image src={HERO} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 scrim-full" />

        <div className="relative z-10 flex min-h-dvh flex-col items-center justify-between px-6 py-14">
          <div />

          <div className="stagger flex flex-col items-center text-center">
            <Image
              src="/brand/logo-horizontal.png"
              alt="Open Collective"
              width={1400}
              height={700}
              priority
              className="h-auto w-[250px] sm:w-[300px]"
            />
            <h1 className="sr-only">Open Collective</h1>
            <p className="muted mt-4 max-w-xs text-[15px] leading-relaxed">
              {hero || "A private circle around the world's quiet places."}
              <br />
              Membership is by referral.
            </p>
            <Link
              href="/login"
              className="btn-champagne tap mt-8 inline-flex h-[52px] items-center px-10 text-[15px]"
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
            <p className="faint mt-8 animate-pulse text-[11px] uppercase tracking-[0.22em]">
              Scroll
            </p>
          </div>

          <div />
        </div>
      </section>

      {/* ——— Manifesto ——— */}
      <div className="bg-base px-6 pb-10 pt-20">
        <div className="mx-auto w-full max-w-xl space-y-16">
          {/* Why we exist */}
          <section>
            <p className="eyebrow">Why we exist</p>
            <h2 className="display mt-3 text-[30px] leading-[1.12] text-ink">
              A trusted global access layer for those who choose intentionally.
            </h2>
            <p className="muted mt-5 text-[14.5px] leading-relaxed">
              Open Collective exists to create a trusted global access layer for high-value
              individuals who understand that the right people and the right environments shape
              better decisions, deeper growth and stronger opportunities.
            </p>
            <p className="muted mt-4 text-[14.5px] leading-relaxed">
              We bring together selected entrepreneurs, visionaries, investors and creators inside
              curated private environments designed for connection, clarity and expansion. Our
              mission is not to build another public community — it is to build a private ecosystem
              where access, trust and alignment become the foundation for growth.
            </p>
          </section>

          {/* What we believe */}
          <section>
            <p className="eyebrow">What we believe</p>
            <p className="display mt-3 text-[22px] leading-snug text-ink">
              Access to the right people. The right rooms of conversation. The right environments.
              The right moments.
            </p>
            <ul className="mt-6 space-y-4">
              {BELIEFS.map((line) => (
                <li key={line.slice(0, 24)} className="flex gap-3">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-champagne" />
                  <p className="muted text-[14px] leading-relaxed">{line}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Quiet by design */}
          <section className="glass p-6 sm:p-7">
            <p className="text-[15px] leading-relaxed text-ink/90">
              Open Collective is not built for visibility. It is built for meaningful access. The
              highest value of the network is the quality of the people within it.
            </p>
            <p className="muted mt-3 text-[13.5px] leading-relaxed">
              We do not measure success by size. We measure it by depth, discretion and the
              strength of relationships between members.
            </p>
          </section>

          {/* Pillars */}
          <section>
            <p className="eyebrow">Three layers</p>
            <div className="mt-5 space-y-3">
              {PILLARS.map((pillar, i) => (
                <div key={pillar.title} className="glass-flat p-5">
                  <p className="faint text-[11px] uppercase tracking-[0.2em]">0{i + 1}</p>
                  <p className="mt-1 text-[16px] font-semibold text-ink">{pillar.title}</p>
                  <p className="muted mt-2 text-[13.5px] leading-relaxed">{pillar.body}</p>
                </div>
              ))}
            </div>
            <p className="faint mt-4 text-[12.5px] leading-relaxed">
              Open Collective is entered through alignment, trust and personal introduction.
              Membership is not open to everyone.
            </p>
          </section>

          {/* Membership */}
          <section>
            <p className="eyebrow">What membership carries</p>
            <ul className="mt-5 space-y-4">
              {MEMBERSHIP.map((line) => (
                <li key={line.slice(0, 24)} className="flex gap-3">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-champagne" />
                  <p className="muted text-[14px] leading-relaxed">{line}</p>
                </li>
              ))}
            </ul>
            <p className="display mt-7 text-[20px] leading-snug text-ink">
              This is for people who do not need more contacts. They need the right circle.
            </p>
          </section>

          {/* Estates */}
          <section>
            <p className="eyebrow">The estates</p>
            <div className="relative mt-5 h-52 overflow-hidden rounded-3xl sm:h-64">
              <Image
                src="/landing/estates.jpg"
                alt="A private estate at dusk"
                fill
                sizes="(max-width: 672px) 100vw, 672px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <p className="absolute bottom-4 left-5 right-5 text-[13px] font-medium text-ink">
                Iconic locations. Private access points — not destinations.
              </p>
            </div>
            <p className="muted mt-5 text-[14px] leading-relaxed">
              Open Collective develops access to selected private villas and estate environments in
              iconic locations around the world. Each location is chosen for its atmosphere,
              privacy, quality and ability to support meaningful connection. These environments are
              not presented as destinations — they are private access points within a global
              members network.
            </p>
            <p className="faint mt-3 text-[12.5px]">
              Access is limited, curated and allocated within the private club framework.
            </p>
          </section>

          {/* The standard */}
          <section className="glass p-6 sm:p-7">
            <p className="eyebrow">The standard</p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink/90">
              Open Collective is not designed for everyone. Membership is based on alignment,
              trust, values and contribution to the collective energy of the network. Every member
              should strengthen the quality of the circle.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Community builders", "Leaders with global orientation", "Individuals of discretion & depth"].map(
                (who) => (
                  <span key={who} className="chip">{who}</span>
                )
              )}
            </div>
            <p className="display mt-6 text-[19px] leading-snug text-champagne">
              The question is not only what you gain access to. The question is what your presence
              adds to the network.
            </p>
          </section>

          {/* Invitation — no form, by design */}
          <section className="pb-4 text-center">
            <p className="display mx-auto max-w-md text-[24px] leading-[1.25] text-ink">
              If it feels like a natural extension of how you already live and build, you are
              invited.
            </p>
            <p className="muted mx-auto mt-4 max-w-sm text-[13.5px] leading-relaxed">
              Access begins with a private alignment conversation. Membership is not publicly
              available — it is granted through personal introduction and alignment.
            </p>
            <Link
              href="/login"
              className="btn-glass tap mt-7 inline-flex h-12 items-center px-9 text-[14px]"
            >
              Enter
            </Link>
          </section>
        </div>

        {/* Footer */}
        <footer className="mx-auto mt-14 max-w-xl border-t border-white/10 pt-7">
          <p className="faint text-center text-[11.5px] leading-relaxed">
            Open Collective is a private members network. Access is subject to alignment and
            personal introduction. Services referenced within the network are optional, externally
            coordinated and arranged through independent third-party providers.
          </p>
          <div
            className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.18em]"
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
        </footer>
      </div>
    </main>
  );
}
