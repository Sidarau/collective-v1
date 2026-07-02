import Image from "next/image";
import Link from "next/link";
import { fetchGates } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GatesPage() {
  const gates = await fetchGates();
  const live = gates.filter((g) => g.status === "published");
  const soon = gates.filter((g) => g.status === "coming_soon");

  return (
    <div className="px-5 pt-14">
      <header className="reveal">
        <p className="eyebrow">Gates</p>
        <h1 className="display mt-2 text-[32px] leading-tight text-ink">
          Places kept for the Circle
        </h1>
        <p className="muted mt-2 text-[14px]">
          Request a window, bring one guest, contribute something only you can.
        </p>
      </header>

      <div className="stagger mt-6 space-y-4">
        {live.map((gate) => (
          <Link
            key={gate.id}
            href={`/app/gates/${gate.slug}`}
            className="glass tap relative block h-72 overflow-hidden"
          >
            {gate.hero_image && (
              <>
                <Image
                  src={gate.hero_image}
                  alt={gate.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 672px"
                  className="object-cover"
                />
                <div className="absolute inset-0 scrim-b" />
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 p-6">
              <span className="chip chip-olive">Open</span>
              <p className="display mt-3 text-[30px] text-ink">{gate.name}</p>
              <p className="muted text-[14px]">{gate.tagline || gate.location}</p>
            </div>
          </Link>
        ))}

        {soon.map((gate) => (
          <div key={gate.id} className="glass relative block h-44 overflow-hidden">
            {gate.hero_image && (
              <Image
                src={gate.hero_image}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 672px"
                className="veiled object-cover"
              />
            )}
            <div className="absolute inset-0 bg-base/30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="chip chip-gold">Coming soon</span>
              <p className="display text-[24px] text-ink/90">{gate.name}</p>
              <p className="faint text-[12px]">{gate.region || gate.location}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
