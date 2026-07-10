"use client";

import { useEffect, useState } from "react";
import DateRangeCalendar, { type DayMark } from "@/components/DateRangeCalendar";

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${iso}T12:00:00Z`)
  );

/**
 * The application form's stay-window field: the same tap-twice calendar as the
 * booking flow, but with no availability shading — a chosen window goes
 * straight to the waiting list. Gold dots mark evenings at the house
 * (member-only ones included, dates only — never titles).
 */
export default function ApplicationWindowPicker({
  onChange,
}: {
  onChange: (value: string) => void;
}) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, DayMark>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/public-events/dates")
      .then((res) => res.json())
      .then((data: { marks?: Record<string, DayMark> }) => {
        if (alive && data?.marks) setMarks(data.marks);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <p className="muted mb-2 px-1 text-[12.5px]">
        {!from
          ? "Tap your arrival, then your departure."
          : !to
            ? "…and your departure."
            : `${fmtDay(from)} → ${fmtDay(to)} — you'll join the waiting list for this window.`}
      </p>
      <DateRangeCalendar
        from={from}
        to={to}
        marks={marks}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
          onChange(f && t ? `${f} → ${t}` : f || "");
        }}
      />
      <p className="faint mt-2 px-1 text-[11.5px] leading-relaxed">
        Gold dots are evenings at the house — some are members-only. Windows are requests for
        the waiting list; the host confirms personally.
      </p>
    </div>
  );
}
