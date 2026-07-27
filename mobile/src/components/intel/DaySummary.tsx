"use client";

import type { DaySummary as DaySummaryData } from "@/data/contracts";
import type { TodayFilterKey } from "@/lib/routes";
import { formatDayLong } from "@/lib/time";
import { formatMoneyCompact } from "@/lib/money";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

type Term = { text: string; filter: TodayFilterKey };

/**
 * The header spends its most valuable space on counts, not a large clock.
 * Three lines maximum: flow, hands, money. Each term applies its filter.
 */
export function DaySummary({
  summary,
  onFilter,
}: {
  summary: DaySummaryData;
  onFilter: (filter: TodayFilterKey) => void;
}) {
  const flow: Term[] = [
    { text: plural(summary.arrivals, "arrival"), filter: "access" },
    { text: plural(summary.departures, "departure"), filter: "access" },
    { text: plural(summary.requests, "request"), filter: "requests" },
  ];

  const hands: Term[] = [
    { text: `${summary.upkeep} upkeep`, filter: "access" },
    { text: `${summary.supplies} supplies`, filter: "access" },
  ];

  const money: Term[] = [
    {
      text: `${formatMoneyCompact(summary.dueMinor, summary.currency)} due`,
      filter: "dues",
    },
    {
      text: `${formatMoneyCompact(summary.incomingMinor, summary.currency)} incoming`,
      filter: "dues",
    },
  ];

  const line = (
    terms: Term[],
    dot: "flow" | "hands" | "money",
    groupLabel: string,
  ) => (
    <li className="day-summary__line">
      <span className={`day-summary__dot day-summary__dot--${dot}`} aria-hidden="true" />
      <span className="sr-only">{groupLabel}: </span>
      {terms.map((term, i) => (
        <span key={term.text} style={{ display: "contents" }}>
          {i > 0 ? (
            <span className="summary-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          <button
            type="button"
            className={`summary-term summary-term--${dot} tnum`}
            onClick={() => onFilter(term.filter)}
            data-testid={`summary-term-${term.filter}`}
          >
            {term.text}
          </button>
        </span>
      ))}
    </li>
  );

  return (
    <section aria-labelledby="today-heading">
      <div className="today-head">
        <h1 id="today-heading" className="today-head__title">
          Today
        </h1>
        <p className="today-head__date">{formatDayLong(summary.isoDate)}</p>
      </div>

      <ul className="day-summary" data-testid="day-summary">
        {line(flow, "flow", "Flow")}
        {line(hands, "hands", "Hands")}
        {line(money, "money", "Money")}
      </ul>
    </section>
  );
}
