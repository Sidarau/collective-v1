import Image from "next/image";
import Link from "next/link";

const HERO =
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2400&auto=format&fit=crop";

/**
 * Landing: deliberately silent. One image, the mark, one action.
 * Everything else lives behind the door.
 */
export default function Landing() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image src={HERO} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 scrim-full" />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-between px-6 py-14">
        <div />

        <div className="stagger flex flex-col items-center text-center">
          <h1 className="wordmark text-2xl text-ink sm:text-3xl">Collective</h1>
          <p className="muted mt-6 max-w-xs text-[15px] leading-relaxed">
            A private circle around the world&apos;s quiet places.
            <br />
            Membership is by referral.
          </p>
          <Link
            href="/login"
            className="btn-champagne tap mt-10 inline-flex h-[52px] items-center px-10 text-[15px]"
          >
            Enter
          </Link>
        </div>

        <p
          className="faint text-[11px] uppercase tracking-[0.18em]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          Ibiza · Est. 2026
        </p>
      </div>
    </main>
  );
}
