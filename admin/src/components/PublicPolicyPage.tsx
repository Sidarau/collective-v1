import Link from "next/link";

export function PublicPolicyPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-base px-5 py-10 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <Link href="/oauth" className="wordmark text-sm text-ink">
          Collective
        </Link>
        <div className="panel mt-8 p-6 sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
          <h1 className="display-serif mt-3 text-4xl text-ink">{title}</h1>
          <p className="mt-2 text-[12px] text-faint">Last updated {updated}.</p>
          <div className="mt-8 space-y-7 text-[14px] leading-7 text-muted">{children}</div>
        </div>
        <nav className="mt-5 flex flex-wrap gap-4 text-[12px] text-muted">
          <Link href="/oauth" className="hover:text-gold">
            Google Calendar integration
          </Link>
          <Link href="/privacy" className="hover:text-gold">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gold">
            Terms
          </Link>
          <Link href="/login" className="hover:text-gold">
            Operator login
          </Link>
        </nav>
      </article>
    </main>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
