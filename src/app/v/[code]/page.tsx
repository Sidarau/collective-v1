import Image from "next/image";
import { loadActiveReferralLink } from "@/lib/screening";
import VendorForm from "./VendorForm";

export const dynamic = "force-dynamic";

const BG =
  "https://images.unsplash.com/photo-1416331108676-a22ccb276e35?q=80&w=2400&auto=format&fit=crop";

/**
 * Public vendor/staff door: housekeepers, chefs, maintenance, drivers…
 * Application first; the interview invitation follows after prescreening.
 */
export default async function VendorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await loadActiveReferralLink(code, "vendor");

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
              <p className="eyebrow">Work with the house</p>
              <h1 className="display mt-3 text-[34px] leading-[1.08] text-ink">
                The house is looking for good hands.
              </h1>
              <p className="muted mt-4 text-[15px] leading-relaxed">
                Housekeeping, kitchen, maintenance, gardens, drivers — tell us what
                you do. If it fits, we&apos;ll invite you to a short call.
              </p>
            </div>
            <div className="reveal mt-8" style={{ animationDelay: "0.16s" }}>
              <VendorForm code={link.code} />
            </div>
          </>
        ) : (
          <div className="glass-strong reveal mt-16 p-8 text-center" style={{ animationDelay: "0.1s" }}>
            <span className="chip">Closed</span>
            <h1 className="display mt-5 text-[28px] leading-[1.12] text-ink">
              This door is no longer open.
            </h1>
            <p className="muted mt-4 text-[15px] leading-relaxed">
              The link you followed has expired or been retired.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
