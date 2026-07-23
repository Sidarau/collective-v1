import Image from "next/image";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth";
import {
  fetchGates,
  fetchMyRequests,
  fetchProfileByUserId,
  fetchUpcomingEvents,
} from "@/lib/data";
import { GATE_TZ, fmtGateDayTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

function greeting(): string {
  // The greeting follows the Gate's clock, matching the photography and copy.
  const h = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: GATE_TZ, hour: "2-digit", hour12: false }).format(new Date()),
    10
  );
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: GATE_TZ, month: "short", day: "numeric" });
const fmtDay = (iso: string) => DATE_FMT.format(new Date(`${iso}T12:00:00Z`));
const fmtEvent = (iso: string) => fmtGateDayTime(iso);

const REQUEST_CHIP: Record<string, { label: string; cls: string }> = {
  requested: { label: "In review", cls: "chip-gold" },
  approved: { label: "Approved", cls: "chip-olive" },
  confirmed: { label: "Confirmed", cls: "chip-olive" },
  deposit_paid: { label: "Confirmed", cls: "chip-olive" },
  paid: { label: "Confirmed", cls: "chip-olive" },
};

export default async function HomePage() {
  const user = (await getAuthUser())!;
  const [profile, gates, events, requests] = await Promise.all([
    fetchProfileByUserId(user.id),
    fetchGates(),
    fetchUpcomingEvents(6),
    fetchMyRequests(user.id),
  ]);

  const firstName = profile?.first_name || user.email.split("@")[0];
  const liveGate = gates.find((g) => g.status === "published");
  const today = new Date().toISOString().slice(0, 10);
  const nextStay = requests.find(
    (r) => r.check_out >= today && !["cancelled", "completed", "inquiry"].includes(r.status)
  );

  return (
    <div className="px-5 pt-4">
      {/* Hero header over photography — the photo melts into the page so there
          is no hard seam where the image ends. */}
      <header className="relative -mx-5 overflow-hidden pb-14 pt-16">
        {liveGate?.hero_image && (
          <>
            <Image
              src={liveGate.hero_image}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 scrim-b" />
            {/* Blend the bottom of the photograph fully into the page base. */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
              style={{ background: "linear-gradient(to bottom, rgba(7,16,14,0) 0%, #07100e 92%)" }}
              aria-hidden="true"
            />
            {/* Soften the very top so it settles under the status bar. */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-20"
              style={{ background: "linear-gradient(to top, rgba(7,16,14,0) 0%, rgba(7,16,14,0.6) 100%)" }}
              aria-hidden="true"
            />
          </>
        )}
        <div className="relative px-5">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Open Collective"
            width={1400}
            height={700}
            priority
            className="reveal mx-auto h-auto w-[184px]"
          />
          <h1 className="display reveal mt-9 text-[34px] leading-tight text-ink" style={{ animationDelay: "0.06s" }}>
            {greeting()}, {firstName}
          </h1>
          <p className="muted reveal mt-1 text-[14px]" style={{ animationDelay: "0.1s" }}>
            {liveGate ? `${liveGate.name} Gate` : "The Circle"} · {user.role === "member" ? "Member" : "Host"}
          </p>
        </div>
      </header>

      <div className="stagger space-y-4">
        {/* Next action */}
        {nextStay ? (
          <Link href="/app/calendar" className="glass tap block p-5">
            <p className="eyebrow">Next window</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[17px] font-semibold text-ink">
                  {nextStay.villas?.name} · {fmtDay(nextStay.check_in)} – {fmtDay(nextStay.check_out)}
                </p>
                <p className="muted mt-1 text-[13px]">
                  {nextStay.rooms?.name}
                  {nextStay.companion_name ? ` · with ${nextStay.companion_name}` : ""}
                </p>
              </div>
              <span className={`chip ${REQUEST_CHIP[nextStay.status]?.cls || ""}`}>
                {REQUEST_CHIP[nextStay.status]?.label || nextStay.status}
              </span>
            </div>
          </Link>
        ) : (
          liveGate && (
            <div className="glass p-5">
              <p className="eyebrow">Next action</p>
              <p className="mt-3 text-[17px] font-semibold text-ink">Plan your window at the Gate</p>
              <p className="muted mt-1 text-[13px]">
                {liveGate.tagline || liveGate.location} · bring one guest
              </p>
              <Link
                href={`/app/gates/${liveGate.slug}/request`}
                className="btn-champagne tap mt-4 inline-flex h-11 items-center px-6 text-[14px]"
              >
                Request a window
              </Link>
            </div>
          )
        )}

        {/* Upcoming events */}
        {events.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="eyebrow">Upcoming</h2>
              <Link href="/app/calendar" className="muted text-[13px]">
                View all
              </Link>
            </div>
            <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5">
              {events.map((ev) => {
                const going = ev.event_rsvps.filter((r) => r.status === "going").length;
                return (
                  <Link
                    key={ev.id}
                    href={`/app/calendar?event=${ev.slug}`}
                    className="glass tap relative block h-44 w-[240px] shrink-0 snap-start overflow-hidden"
                  >
                    {ev.image && (
                      <>
                        <Image src={ev.image} alt="" fill sizes="240px" className="object-cover" />
                        <div className="absolute inset-0 scrim-card" />
                      </>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="eyebrow">{fmtEvent(ev.start_at)}</p>
                      <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">{ev.title}</p>
                      <p className="muted mt-1 text-[12px]">
                        {ev.villas?.name} · {going} going
                      </p>
                      {ev.audience === "public" && (
                        <span className="chip chip-gold mt-2">Public guest</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Featured gate */}
        {liveGate && (
          <Link
            href={`/app/gates/${liveGate.slug}`}
            className="glass tap relative block h-56 overflow-hidden"
          >
            {liveGate.hero_image && (
              <>
                <Image
                  src={liveGate.hero_image}
                  alt={liveGate.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 672px"
                  className="object-cover"
                />
                <div className="absolute inset-0 scrim-b" />
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="eyebrow">Featured Gate</p>
              <p className="display mt-1 text-[26px] text-ink">{liveGate.name}</p>
              <p className="muted text-[13px]">{liveGate.tagline || liveGate.location}</p>
            </div>
          </Link>
        )}

        {/* Exchange teaser */}
        <div className="glass p-5">
          <p className="eyebrow">Exchange</p>
          <p className="mt-3 text-[15px] font-semibold text-ink">Offers, asks, and collaborations</p>
          <p className="muted mt-1 text-[13px]">
            The member exchange opens soon — sessions, intros, and shameless plugs, curated.
          </p>
        </div>

        {/* Profile shortcut */}
        <Link href="/app/profile" className="glass-flat tap flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-champagne/20 text-[15px] font-semibold text-champagne">
              {firstName[0]?.toUpperCase()}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink">
                {profile ? `${profile.first_name} ${profile.last_name}` : firstName}
              </p>
              <p className="muted text-[12px]">View your profile</p>
            </div>
          </div>
          <span className="muted">›</span>
        </Link>
      </div>
    </div>
  );
}
