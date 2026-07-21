import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { fetchContentBlock, fetchPublicEvents } from "@/lib/data";
import { fmtGateDayTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

// The owner-supplied Roca Llisa gate image is the visual anchor for both the
// full-bleed entrance and the environment card below.
const ROCA_LLISA_IMAGE = "/villa/roca-llisa-gate.jpg";

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
    title: "Environments & Spaces",
    body: "Where a conversation happens shapes where it leads. We hold a small collection of private environments and spaces — homes, tables, terraces — chosen so presence comes easily and the circle feels at home.",
  },
];

const MEMBERSHIP = [
  "A curated circle of entrepreneurs, investors, creators and visionaries who value trust, growth and meaningful relationships.",
  "Private conversations, shared perspectives and high-level proximity that support personal development, entrepreneurial clarity and new opportunities.",
  "Access to selected private villas and curated environments around the world — designed for presence, connection, focus and elevated community moments.",
];

// Who it's for — Don's eight, kept as a quiet numbered set.
const WHO = [
  "Entrepreneurs",
  "Founders",
  "Investors",
  "Creators",
  "Visionaries",
  "Community builders",
  "Leaders with global orientation",
  "Individuals of discretion & depth",
];

/**
 * Landing: a silent hero over the real estate (the mark, one action), then the
 * manifesto — Don's prototype copy set in the house style. No application form
 * here; entrance stays behind the door.
 */
export default async function Landing() {
  const [hero, publicEvents] = await Promise.all([
    fetchContentBlock("landing.hero"),
    fetchPublicEvents(3),
  ]);

  return (
    <main className="relative">
      {/* Nav lives at the page root (not inside the hero) so its fixed
          positioning + z-index sit above every section's stacking context. */}
      <LandingNav />
      {/* ——— Hero ——— */}
      <section id="top" className="landing-hero relative min-h-dvh overflow-hidden bg-[#07110d]">
        <Image
          src={ROCA_LLISA_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-photo-ambient"
          aria-hidden="true"
        />
        <Image
          src={ROCA_LLISA_IMAGE}
          alt="Roca Llisa — a private estate above the Ibiza coast"
          fill
          priority
          sizes="100vw"
          className="hero-photo-detail"
        />
        <div className="hero-scrim absolute inset-0" aria-hidden="true" />

        <div className="hero-stage relative z-10 flex min-h-dvh flex-col items-center px-6 pb-10 pt-28 sm:px-10 sm:pb-12 sm:pt-32">
          <div className="hero-lockup stagger my-auto flex flex-col items-center text-center">
            <Image
              src="/brand/logo-horizontal.png"
              alt="Open Collective"
              width={1400}
              height={700}
              priority
              className="hero-brand h-auto w-[235px] sm:w-[330px]"
            />
            <h1 className="sr-only">Open Collective</h1>
            <p className="hero-copy mt-5 max-w-sm text-[17px] leading-relaxed sm:mt-7 sm:max-w-xl sm:text-[24px]">
              {hero || "A private circle around the world's quiet places."}
              <br />
              Membership is by referral.
            </p>
            <div className="hero-meta" aria-label="Collective details">
              <span>Ibiza · Est. 2026</span>
              <span>By referral only</span>
            </div>
            <Link
              href="/login"
              className="btn-champagne hero-enter tap inline-flex h-[54px] items-center px-11 text-[15px] sm:h-[58px] sm:px-14 sm:text-[16px]"
            >
              Enter
            </Link>
          </div>

          {/* Scroll cue — the site continues below the fold */}
          <a
            href="#more"
            aria-label="Scroll to read more"
            className="hero-scroll tap flex flex-col items-center gap-2 transition-colors hover:text-ink"
          >
            <span className="text-[11px] uppercase tracking-[0.22em]">Scroll</span>
            <svg
              className="animate-bounce"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </a>
        </div>
      </section>

      {/* ——— Manifesto ——— */}
      <div id="more" className="bg-base px-6 pb-10 pt-20 scroll-mt-4 sm:px-10 lg:pt-28">
        <div className="mx-auto w-full max-w-6xl space-y-20 lg:space-y-28">
          {publicEvents.length > 0 && (
            <section aria-label="Upcoming access">
              <p className="eyebrow">Upcoming access</p>
              <p className="display mt-3 text-[24px] leading-tight text-ink sm:text-[28px]">
                Meet the circle in Ibiza.
              </p>
              {/* Events float on their own — no outer glass wrapper. */}
              <div className="mt-6 grid gap-4 sm:mt-7 sm:grid-cols-2 lg:grid-cols-3">
                {publicEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="glass-flat tap block p-5 text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[14px] font-semibold text-ink sm:text-[15px]">{event.title}</p>
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

          {/* Access changes everything */}
          <section id="about" className="scroll-mt-32 lg:grid lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
            <div>
              <p className="eyebrow">Open Collective</p>
              <h2 className="display mt-3 text-[32px] leading-[1.08] text-ink sm:text-[40px] lg:text-[54px]">
                Access changes everything.
              </h2>
            </div>
            <div className="lg:pt-7">
              <p className="mt-5 text-[15.5px] leading-relaxed text-ink/90 lg:mt-0 lg:text-[19px]">
                A private members network for entrepreneurs, visionaries and leaders who choose their
                environments, relationships and next level with intention.
              </p>
              <p className="muted mt-4 text-[14.5px] leading-relaxed lg:text-[16px]">
                We bring together selected entrepreneurs, visionaries, investors and creators inside
                curated private environments designed for connection, clarity and expansion. Our
                mission is not to build another public community — it is to build a private ecosystem
                where access, trust and alignment become the foundation for growth.
              </p>
            </div>
          </section>

          {/* What we believe */}
          <section id="principles" className="scroll-mt-32">
            <p className="eyebrow">What we believe</p>
            <p className="display mt-3 text-[22px] leading-snug text-ink">
              Access to the right people. The right environments. The right spaces. The right
              moments.
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
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
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

          <div className="grid gap-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            {/* Membership */}
            <section id="membership" className="scroll-mt-32">
              <p className="eyebrow">What membership carries</p>
              <ul className="mt-5 space-y-4">
                {MEMBERSHIP.map((line) => (
                  <li key={line.slice(0, 24)} className="flex gap-3">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-champagne" />
                    <p className="muted text-[14px] leading-relaxed lg:text-[15px]">{line}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Who it's for */}
            <section id="network" className="scroll-mt-32">
              <p className="eyebrow">Who it&apos;s for</p>
              <h2 className="display mt-3 text-[24px] leading-snug text-ink lg:text-[32px]">
                Built for people who choose their circle with intention.
              </h2>
              <p className="muted mt-4 text-[14px] leading-relaxed">
                Not a bigger network — a better one. The people here are building something real, and
                their presence makes the room sharper for everyone in it.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {WHO.map((who, i) => (
                  <div key={who} className="glass-flat flex items-baseline gap-3 p-4">
                    <span className="faint text-[11px] tracking-[0.12em]">0{i + 1}</span>
                    <span className="text-[13.5px] font-medium leading-snug text-ink">{who}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Global environments */}
          <section id="environments" className="scroll-mt-32">
            <p className="eyebrow">Global environments</p>
            <h2 className="display mt-3 text-[24px] leading-snug text-ink">
              Curated private environments around the world.
            </h2>
            <div className="mt-7 grid gap-7 lg:grid-cols-[1.4fr_0.6fr] lg:items-center lg:gap-12">
              <div className="relative overflow-hidden rounded-3xl bg-[#07110d]">
                <Image
                  src={ROCA_LLISA_IMAGE}
                  alt="Roca Llisa, Ibiza — a private access point above the sea"
                  width={1200}
                  height={630}
                  sizes="(max-width: 1024px) 100vw, 760px"
                  className="h-auto w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <p className="absolute bottom-4 left-5 right-5 text-[13px] font-medium text-ink">
                  Roca Llisa, Ibiza — a private access point, not a destination.
                </p>
              </div>
              <div>
                <p className="muted text-[14px] leading-relaxed lg:text-[15px]">
                  Open Collective develops access to selected private villas and estate environments in
                  iconic locations — from Ibiza and the Mediterranean to the Alps and the United States.
                  Each is chosen for its atmosphere, privacy, quality and ability to support meaningful
                  connection. These are not destinations — they are private access points within a
                  global members network.
                </p>
                <p className="faint mt-3 text-[12.5px]">
                  Access is limited, curated and allocated within the private club framework.
                </p>
              </div>
            </div>
          </section>

          {/* The standard */}
          <section className="glass p-6 sm:p-7">
            <p className="eyebrow">The standard</p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink/90">
              Open Collective is not designed for everyone. Membership is based on alignment,
              trust, values and contribution to the collective energy of the network. Every member
              should strengthen the quality of the circle.
            </p>
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
        <footer className="mx-auto mt-20 max-w-6xl border-t border-white/10 pt-7">
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
