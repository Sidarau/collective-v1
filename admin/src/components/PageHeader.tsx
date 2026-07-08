export default function PageHeader({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-6">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            {eyebrow}
          </p>
        )}
        <h2 className="display-serif mt-1 text-[26px] text-ink">{title}</h2>
      </div>
      {children}
    </header>
  );
}
