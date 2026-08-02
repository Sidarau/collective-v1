import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFounderReviewAccess } from "@/lib/founder-review-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Collective — Founder Review",
  description: "Private Open Collective founder working material",
  robots: { index: false, follow: false, nocache: true },
};

export default async function FounderReviewPage() {
  const access = await getFounderReviewAccess();
  if (access.status === "unauthenticated") {
    redirect("/login?next=%2Ffounder-review");
  }
  if (access.status === "forbidden") notFound();

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-base">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[#07100e] px-3 sm:px-5">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
          Founder account verified
        </p>
        <Link
          href="/"
          className="focus-ring rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-muted transition hover:border-white/25 hover:text-ink"
        >
          Operator OS
        </Link>
      </header>
      <iframe
        src="/founder-review/content"
        title="Open Collective founder review"
        className="min-h-0 w-full flex-1 border-0"
        sandbox="allow-scripts allow-downloads allow-popups allow-top-navigation-by-user-activation"
        allow="clipboard-write"
        referrerPolicy="no-referrer"
      />
    </main>
  );
}
