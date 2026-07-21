import Image from "next/image";
import StaffForm from "./StaffForm";

const BG =
  "/villa/roca-llisa-hero.jpg";

export const metadata = { title: "Collective — Work with us" };

/**
 * Public staff funnel (shared by direct link; not linked from the landing).
 * Separate from membership — feeds the staff pipeline in the operator console.
 */
export default function StaffPage() {
  return (
    <main className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10">
        <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 scrim-full" />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-16 pt-12">
        <p className="wordmark reveal text-center text-sm text-ink">Collective</p>
        <div className="reveal mt-10" style={{ animationDelay: "0.08s" }}>
          <p className="eyebrow">The house team</p>
          <h1 className="display mt-3 text-[34px] leading-[1.08] text-ink">
            Work the season with us.
          </h1>
          <p className="muted mt-4 text-[15px] leading-relaxed">
            Chefs, house managers, concierges, drivers, wellness practitioners —
            tell us what you do best.
          </p>
        </div>
        <div className="reveal mt-8" style={{ animationDelay: "0.16s" }}>
          <StaffForm />
        </div>
      </div>
    </main>
  );
}
