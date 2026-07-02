export const dynamic = "force-dynamic";

const PREVIEWS = [
  { type: "Offer", title: "AI ops audit for scaling teams", by: "Zeug Lab" },
  { type: "Ask", title: "Private-jet charter share, Ibiza → Nice", by: "A member" },
  { type: "Session", title: "Collectors' wine dinner at the Gate", by: "A member" },
];

export default function ExchangePage() {
  return (
    <div className="px-5 pt-14">
      <header className="reveal">
        <p className="eyebrow">Exchange</p>
        <h1 className="display mt-2 text-[32px] leading-tight text-ink">
          The member exchange
        </h1>
        <p className="muted mt-2 max-w-sm text-[14px] leading-relaxed">
          Offers, asks, sessions, and collaborations — curated by the concierge,
          visible only inside the Circle.
        </p>
      </header>

      <div className="relative mt-8">
        <div className="stagger space-y-3 opacity-60 blur-[2px]" aria-hidden>
          {PREVIEWS.map((p) => (
            <div key={p.title} className="glass p-5">
              <span className="chip chip-gold">{p.type}</span>
              <p className="mt-3 text-[15px] font-semibold text-ink">{p.title}</p>
              <p className="muted mt-1 text-[12px]">{p.by}</p>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="glass-strong reveal px-8 py-6 text-center">
            <span className="chip chip-gold">Coming soon</span>
            <p className="mt-3 text-[15px] font-semibold text-ink">Opening later this season</p>
            <p className="muted mt-1 max-w-[240px] text-[13px]">
              Have something to offer meanwhile? Tell your host — it goes on the board first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
