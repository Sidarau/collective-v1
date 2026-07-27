"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NumbersOfTheDay, NumbersPeriod } from "@/data/contracts";
import { formatDayShort } from "@/lib/time";
import { displayTime } from "@/lib/time";
import { MetricStrip, PeriodControl } from "./Metrics";

/**
 * The compact summary expands in place, or opens /briefing.
 *
 * Forecast is labelled separately from confirmed and outstanding money, and
 * the data-as-of time is shown in the expanded view so a projection is never
 * mistaken for cash received.
 */
export function NumbersDisclosure({
  numbers,
}: {
  numbers: Record<NumbersPeriod, NumbersOfTheDay>;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<NumbersPeriod>("today");
  const active = numbers[period];

  const money = active.metrics.filter((m) =>
    ["forecast", "confirmed", "outstanding", "expense"].includes(m.kind),
  );
  const counts = active.metrics.filter((m) => ["count", "ratio"].includes(m.kind));

  return (
    <section aria-label="Numbers of the day">
      <button
        type="button"
        className="numbers-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="numbers-toggle"
      >
        {open ? "Hide numbers" : "Numbers of the day"}
        <ChevronDown size={15} className="numbers-toggle__chev" aria-hidden="true" />
      </button>

      {open ? (
        <div style={{ marginTop: 10 }} data-testid="numbers-panel">
          <PeriodControl value={period} onChange={setPeriod} />

          <p className="field__label" style={{ marginTop: 14 }}>
            Money — forecast is a projection, not received
          </p>
          <MetricStrip metrics={money} />

          <p className="field__label" style={{ marginTop: 14 }}>
            Operations
          </p>
          <MetricStrip metrics={counts} />

          <p
            className="field__hint"
            style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}
          >
            <span>
              Data as of {formatDayShort(active.asOf)}
              {displayTime(active.asOf, "minute") ? ` · ${displayTime(active.asOf, "minute")}` : ""}
            </span>
            <Link href="/briefing" style={{ color: "var(--color-champagne)" }}>
              Full briefing
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
