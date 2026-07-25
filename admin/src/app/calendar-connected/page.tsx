import Image from "next/image";

export default async function CalendarConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-base px-4">
      <Image
        src="/villa/roca-llisa-hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: "38% center" }}
      />
      <div className="absolute inset-0" style={{ background: "rgba(7,16,14,0.88)" }} />
      <section className="panel relative z-10 w-full max-w-md p-7 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gold">Collective</p>
        <h1 className="mt-3 text-xl font-semibold text-ink">
          {error ? "This link needs Alex" : "Calendar connected"}
        </h1>
        {error ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{error}. Ask Alex for a fresh link.</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              That&apos;s it. Selene can now include your approved calendars in your daily update.
              You can close this page.
            </p>
            <p className="mt-5 text-[12px] text-faint">
              Selene cannot approve sensitive calendar changes herself.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
