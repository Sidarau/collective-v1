import Image from "next/image";
import { loadActiveReferralLink } from "@/lib/screening";
import { fetchContentBlock } from "@/lib/data";
import ReferralForm from "./ReferralForm";

export const dynamic = "force-dynamic";

const BG =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2400&auto=format&fit=crop";

/**
 * The public front door: a referral link IS the invitation. No login — the
 * prospect introduces themselves and books the host call in one sitting.
 */
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [link, intro] = await Promise.all([
    loadActiveReferralLink(code, "member"),
    fetchContentBlock("join.intro"),
  ]);

  return (
    <main className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10">
        <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 scrim-full" />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-16 pt-12">
        <p className="wordmark reveal text-center text-sm text-ink">Collective</p>

        {link ? (
          <>
            <div className="reveal mt-10" style={{ animationDelay: "0.08s" }}>
              <p className="eyebrow">Your introduction</p>
              <h1 className="display mt-3 text-[34px] leading-[1.08] text-ink">
                A door has been opened for you.
              </h1>
              <p className="muted mt-4 text-[15px] leading-relaxed">
                {intro ||
                  "Introductions are personal. Tell us who you are — then choose fifteen minutes with the host."}
              </p>
            </div>
            <div className="reveal mt-8" style={{ animationDelay: "0.16s" }}>
              <ReferralForm code={link.code} />
            </div>
          </>
        ) : (
          <div className="glass-strong reveal mt-16 p-8 text-center" style={{ animationDelay: "0.1s" }}>
            <span className="chip">Closed</span>
            <h1 className="display mt-5 text-[28px] leading-[1.12] text-ink">
              This door is no longer open.
            </h1>
            <p className="muted mt-4 text-[15px] leading-relaxed">
              The link you followed has expired or been retired. Ask the member who
              referred you for a fresh one.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
