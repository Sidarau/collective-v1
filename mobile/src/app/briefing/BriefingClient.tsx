"use client";

import { useState } from "react";
import type {
  AccessRequest,
  ForecastSeries,
  NumbersOfTheDay,
  NumbersPeriod,
  Result,
} from "@/data/contracts";
import { formatDayShort, displayTime } from "@/lib/time";
import { ForecastCurve, MetricStrip, PeriodControl } from "@/components/intel/Metrics";
import {
  AttentionList,
  IntelligenceScreen,
  Section,
} from "@/components/templates/templates";
import { ResultBoundary } from "@/components/templates/ResultBoundary";

export function BriefingClient({
  numbers,
  forecasts,
  requests,
}: {
  numbers: Record<NumbersPeriod, Result<NumbersOfTheDay>>;
  forecasts: Record<NumbersPeriod, Result<ForecastSeries>>;
  requests: Result<AccessRequest[]>;
}) {
  const [period, setPeriod] = useState<NumbersPeriod>("today");

  return (
    <IntelligenceScreen
      title="Daily briefing"
      subtitle="Numbers of the day"
      backHref="/"
      controls={<PeriodControl value={period} onChange={setPeriod} />}
    >
      <Section title="Money">
        <ResultBoundary result={forecasts[period]} skeletonRows={2}>
          {(series) => <ForecastCurve series={series} />}
        </ResultBoundary>
      </Section>

      <ResultBoundary result={numbers[period]} skeletonRows={4}>
        {(data) => (
          <>
            <Section title="Revenue">
              <MetricStrip
                metrics={data.metrics.filter((m) =>
                  ["forecast", "confirmed", "outstanding", "expense"].includes(m.kind),
                )}
              />
            </Section>

            <Section title="Operations">
              <MetricStrip
                metrics={data.metrics.filter((m) => ["count", "ratio"].includes(m.kind))}
              />
            </Section>

            <p className="field__hint" style={{ marginTop: 12 }}>
              Data as of {formatDayShort(data.asOf)}
              {displayTime(data.asOf, "minute") ? ` · ${displayTime(data.asOf, "minute")}` : ""}.
              Forecast is a projection, not money received.
            </p>
          </>
        )}
      </ResultBoundary>

      <Section title="Needs a decision">
        <ResultBoundary result={requests} emptyTitle="Nothing needs a decision" emptyBody="Every request is resolved.">
          {(rows) => (
            <AttentionList
              items={rows
                .filter((r) => r.state.tone === "critical" || r.state.tone === "attention")
                .map((r) => ({
                  id: r.id,
                  title: r.personName,
                  detail: `${r.gateName} · ${r.periodLabel}`,
                  href: `/requests/${r.id}`,
                  state: r.state,
                }))}
            />
          )}
        </ResultBoundary>
      </Section>
    </IntelligenceScreen>
  );
}
