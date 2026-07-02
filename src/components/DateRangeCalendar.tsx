"use client";

import { useMemo, useState } from "react";

export interface DayMark {
  events?: number;
  presence?: number;
  full?: boolean;
}

interface Props {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  marks?: Record<string, DayMark>;
  minDate?: string;
  initialMonth?: string; // YYYY-MM
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Airbnb-style tap-twice range picker over a liquid-glass month grid.
 * First tap sets check-in, second sets check-out; tapping earlier restarts.
 */
export default function DateRangeCalendar({
  from,
  to,
  onChange,
  marks = {},
  minDate,
  initialMonth,
}: Props) {
  const todayISO = toISO(new Date());
  const min = minDate || todayISO;
  const [month, setMonth] = useState(() => {
    const base = initialMonth ? new Date(`${initialMonth}-01T12:00:00Z`) : new Date();
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  });

  const grid = useMemo(() => {
    const year = month.getUTCFullYear();
    const m = month.getUTCMonth();
    const first = new Date(Date.UTC(year, m, 1));
    const startOffset = (first.getUTCDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const cells: (string | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toISO(new Date(Date.UTC(year, m, d))));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  function tap(day: string) {
    if (day < min) return;
    if (marks[day]?.full && (!from || to)) return;
    if (!from || (from && to)) {
      onChange(day, null);
    } else if (day <= from) {
      onChange(day, null);
    } else {
      onChange(from, day);
    }
  }

  function shiftMonth(delta: number) {
    setMonth((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + delta, 1)));
  }

  const inRange = (day: string) => from && to && day > from && day < to;

  return (
    <div className="glass p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <button type="button" onClick={() => shiftMonth(-1)} className="btn-glass tap h-9 w-9 text-[15px]" aria-label="Previous month">
          ‹
        </button>
        <p className="text-[14px] font-semibold text-ink">{MONTH_FMT.format(month)}</p>
        <button type="button" onClick={() => shiftMonth(1)} className="btn-glass tap h-9 w-9 text-[15px]" aria-label="Next month">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}${i}`} className="faint pb-1 text-[10px] font-semibold uppercase tracking-wide">
            {d}
          </span>
        ))}
        {grid.map((day, i) => {
          if (!day) return <span key={`x${i}`} />;
          const disabled = day < min || (!!marks[day]?.full && !(from && !to && day > from));
          const isEdge = day === from || day === to;
          const mark = marks[day];
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => tap(day)}
              className={`relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-[13px] transition ${
                isEdge
                  ? "bg-champagne font-semibold text-base"
                  : inRange(day)
                    ? "bg-champagne/25 text-ink"
                    : disabled
                      ? "text-ink/20 line-through decoration-transparent"
                      : "text-ink/85 active:scale-95"
              }`}
            >
              {day.slice(8).replace(/^0/, "")}
              {(mark?.events || mark?.presence) && !isEdge ? (
                <span className="absolute bottom-1 flex gap-0.5">
                  {mark.events ? <span className="h-1 w-1 rounded-full bg-champagne" /> : null}
                  {mark.presence ? <span className="h-1 w-1 rounded-full bg-olive" /> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
