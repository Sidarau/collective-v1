import type { TimelineItem } from "@/lib/admin-data";
import StatusChip from "./StatusChip";

const KIND_ICON: Record<TimelineItem["kind"], string> = {
  audit: "◆",
  note: "✎",
  email: "✉",
};

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-faint">No activity yet.</p>;
  }
  return (
    <ol className="divide-y divide-line">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 px-4 py-3">
          <span className="mt-0.5 w-4 shrink-0 text-center text-xs text-gold">
            {KIND_ICON[item.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-medium text-ink">{item.title}</p>
              {item.status && <StatusChip value={item.status} />}
            </div>
            {item.detail && (
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
                {item.detail}
              </p>
            )}
            {item.revealLink && (
              <details className="reveal-link mt-1">
                <summary>Reveal entrance link</summary>
                <code>{item.revealLink}</code>
              </details>
            )}
            <p className="mt-1 text-[11px] text-faint">
              {fmtWhen(item.at)}
              {item.actor ? ` · ${item.actor}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
