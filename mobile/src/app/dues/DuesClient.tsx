"use client";

import { useState } from "react";
import type {
  ForecastSeries,
  Metric,
  NumbersOfTheDay,
  NumbersPeriod,
  Result,
  Transaction,
} from "@/data/contracts";
import { PageTitle } from "@/components/shell/MobileShell";
import { ForecastCurve, MetricStrip, PeriodControl } from "@/components/intel/Metrics";
import { FilterTabs } from "@/components/intel/FilterTabs";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { MoneyRow } from "@/components/rows/rows";

type FilterKey = "all" | "incoming" | "outgoing" | "outstanding";

const FILTERS = [
  { key: "all" as const, label: "All" },
  { key: "incoming" as const, label: "Incoming" },
  { key: "outgoing" as const, label: "Outgoing" },
  { key: "outstanding" as const, label: "Outstanding" },
];

const PERIOD_LABEL: Record<NumbersPeriod, string> = {
  today: "Today",
  "7d": "Next 7 days",
  "30d": "Next 30 days",
};

export function DuesClient({
  transactions,
  forecasts,
  numbers,
}: {
  transactions: Result<Transaction[]>;
  forecasts: Record<NumbersPeriod, Result<ForecastSeries>>;
  numbers: Record<NumbersPeriod, Result<NumbersOfTheDay>>;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [period, setPeriod] = useState<NumbersPeriod>("30d");

  const all = transactions.status === "ok" ? transactions.data : [];
  const rows = all.filter((t) =>
    filter === "all"
      ? true
      : filter === "outstanding"
        ? t.settlement === "outstanding"
        : t.direction === filter,
  );

  const activeNumbers = numbers[period];
  const strip: Metric[] =
    activeNumbers.status === "ok"
      ? activeNumbers.data.metrics.filter((m) =>
          ["access_periods", "avg_access_value", "utilization", "expenses"].includes(m.key),
        )
      : [];

  return (
    <>
      <PageTitle title="Dues" subtitle={PERIOD_LABEL[period]} backHref="/more" />

      <div style={{ marginTop: 14 }}>
        <PeriodControl value={period} onChange={setPeriod} />
      </div>

      <ResultBoundary result={forecasts[period]} skeletonRows={2}>
        {(series) => <ForecastCurve series={series} />}
      </ResultBoundary>

      {strip.length ? <MetricStrip metrics={strip} columns={4} /> : null}

      <FilterTabs
        label="Dues filters"
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        resultCount={rows.length}
        resultNoun="entries"
        controlsPanel
      />

      <div id={`panel-${filter}`} role="tabpanel" aria-labelledby={`tab-${filter}`}>
        <ResultBoundary
          result={transactions}
          emptyTitle="No money movement"
          emptyBody="Contributions, expenses and invoices will appear here."
        >
          {() =>
            rows.length ? (
              <ul className="list">
                {rows.map((t) => (
                  <MoneyRow key={t.id} transaction={t} />
                ))}
              </ul>
            ) : (
              <p className="empty-state__body" style={{ padding: "28px 0" }}>
                Nothing in this filter.
              </p>
            )
          }
        </ResultBoundary>
      </div>
    </>
  );
}
