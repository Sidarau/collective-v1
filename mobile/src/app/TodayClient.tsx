"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type {
  DaySummary as DaySummaryData,
  NumbersOfTheDay,
  NumbersPeriod,
  Result,
  TimelinePage,
} from "@/data/contracts";
import { TODAY_FILTERS, type TodayFilterKey } from "@/lib/routes";
import { DaySummary } from "@/components/intel/DaySummary";
import { NumbersDisclosure } from "@/components/intel/NumbersDisclosure";
import { FilterTabs } from "@/components/intel/FilterTabs";
import { TimelineStream } from "@/components/timeline/TimelineStream";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { EmptyState } from "@/components/ui/primitives";

export function TodayClient({
  summary,
  numbers,
  timeline,
  filter,
  nowIso,
}: {
  summary: Result<DaySummaryData>;
  numbers: Record<NumbersPeriod, NumbersOfTheDay>;
  timeline: Result<TimelinePage>;
  filter: TodayFilterKey;
  nowIso: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  /* Filters persist in URL state so a view survives reload and deep links. */
  const setFilter = useCallback(
    (key: TodayFilterKey) => {
      const next = new URLSearchParams(params.toString());
      if (key === "all") next.delete("filter");
      else next.set("filter", key);
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [params, router],
  );

  const count = timeline.status === "ok" ? timeline.data.events.length : 0;

  return (
    <>
      <ResultBoundary
        result={summary}
        emptyTitle="No operations today"
        emptyBody="Arrivals, requests and dues will appear here as they are created."
        skeletonRows={3}
      >
        {(data) => (
          <>
            <DaySummary summary={data} onFilter={setFilter} />
            <NumbersDisclosure numbers={numbers} />
          </>
        )}
      </ResultBoundary>

      <FilterTabs
        label="Timeline filters"
        options={TODAY_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        value={filter}
        onChange={setFilter}
        resultCount={count}
        resultNoun="operations"
      />

      <div id={`panel-${filter}`} role="tabpanel" aria-labelledby={`tab-${filter}`}>
        <ResultBoundary
          result={timeline}
          emptyTitle="Nothing in this filter"
          emptyBody="Switch to All to see the whole day, or add work with the + control."
        >
          {(page) => (
            <TimelineStream
              events={page.events}
              nowIso={nowIso}
              bidirectional
              emptyState={
                <EmptyState
                  title="Nothing in this filter"
                  body="Switch to All to see the whole day."
                />
              }
            />
          )}
        </ResultBoundary>
      </div>
    </>
  );
}
