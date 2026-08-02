"use client";

import type { ForecastSeries, Metric, NumbersPeriod } from "@/data/contracts";
import { formatMoney } from "@/lib/money";
import { Segmented } from "@/components/ui/forms";

/** Today / 7 days / 30 days. */
export function PeriodControl({
  value,
  onChange,
}: {
  value: NumbersPeriod;
  onChange: (p: NumbersPeriod) => void;
}) {
  return (
    <Segmented<NumbersPeriod>
      label="Period"
      value={value}
      onChange={onChange}
      options={[
        { value: "today", label: "Today" },
        { value: "7d", label: "7 days" },
        { value: "30d", label: "30 days" },
      ]}
    />
  );
}

/** Compact sparkline; only rendered with at least five comparable points. */
function Sparkline({ points, tone = "healthy" }: { points: number[]; tone?: string }) {
  if (points.length < 5) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 100;
  const h = 26;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 3) - 1.5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="metric-tile__spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke={tone === "healthy" ? "var(--color-healthy)" : "var(--color-champagne)"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Two to four metrics — never a generic grid of glass cards.
 * `kind` keeps forecast visually and textually distinct from settled money.
 */
export function MetricStrip({
  metrics,
  columns = 2,
}: {
  metrics: Metric[];
  columns?: 2 | 4;
}) {
  return (
    <div
      className={`metric-strip${columns === 4 ? " metric-strip--four" : ""}`}
      data-testid="metric-strip"
    >
      {metrics.map((m) => (
        <div className="metric-tile" key={m.key}>
          <span className="metric-tile__label">{m.label}</span>
          <span className="metric-tile__value tnum">{m.value}</span>
          {m.deltaLabel ? (
            <span
              className={`metric-tile__delta metric-tile__delta--${
                m.deltaDirection ?? "up"
              } tnum`}
            >
              {m.deltaLabel}
            </span>
          ) : null}
          {m.spark ? (
            <Sparkline points={m.spark} tone={m.kind === "forecast" ? "champagne" : "healthy"} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Settled money is a solid line; projection is dashed and labelled.
 * Projected revenue is never presented as cash received.
 */
export function ForecastCurve({ series }: { series: ForecastSeries }) {
  const values = series.points.flatMap((p) =>
    [p.settledMinor, p.projectedMinor].filter((v): v is number => v !== null),
  );
  const max = Math.max(...values, 1);
  const w = 320;
  const h = 96;

  const path = (key: "settledMinor" | "projectedMinor") => {
    const pts = series.points
      .map((p, i) => ({ i, v: p[key] }))
      .filter((p): p is { i: number; v: number } => p.v !== null);
    if (pts.length < 2) return "";
    return pts
      .map((p, n) => {
        const x = (p.i / (series.points.length - 1)) * w;
        const y = h - (p.v / max) * (h - 8) - 4;
        return `${n === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const todayX = (series.todayIndex / (series.points.length - 1)) * w;

  return (
    <figure className="forecast" style={{ margin: 0 }} data-testid="forecast-curve">
      <figcaption className="sr-only">
        {`Revenue forecast ${formatMoney(series.forecastMinor, series.currency)}. ` +
          `Confirmed ${formatMoney(series.confirmedMinor, series.currency)}. ` +
          `Outstanding ${formatMoney(series.outstandingMinor, series.currency)}. ` +
          `The projected line is an estimate, not money received.`}
      </figcaption>

      <div>
        <p
          className="display tnum"
          style={{ fontSize: "var(--text-page)", lineHeight: "var(--text-page--line-height)", margin: 0 }}
        >
          {formatMoney(series.forecastMinor, series.currency)}{" "}
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "var(--text-meta)",
              color: "var(--color-ink-dim)",
            }}
          >
            forecast
          </span>
        </p>
        <p style={{ fontSize: "var(--text-meta)", color: "var(--color-ink-dim)", margin: "4px 0 0" }}>
          <span className="tnum">{formatMoney(series.confirmedMinor, series.currency)}</span>{" "}
          confirmed ·{" "}
          <span className="tnum">{formatMoney(series.outstandingMinor, series.currency)}</span>{" "}
          outstanding
        </p>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 96, marginTop: 10, display: "block" }}
        aria-hidden="true"
        focusable="false"
      >
        <line
          x1={todayX}
          y1="0"
          x2={todayX}
          y2={h}
          stroke="var(--color-line-strong)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path("settledMinor")}
          fill="none"
          stroke="var(--color-healthy)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path("projectedMinor")}
          fill="none"
          stroke="var(--color-ink-dim)"
          strokeWidth="1.4"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="forecast__legend">
        <span>
          <i className="legend-swatch" aria-hidden="true" /> Settled
        </span>
        <span>
          <i className="legend-swatch legend-swatch--projected" aria-hidden="true" /> Projected
        </span>
      </div>
    </figure>
  );
}
