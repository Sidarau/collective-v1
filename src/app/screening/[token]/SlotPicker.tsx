"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SlotDay {
  dateKey: string;
  label: string;
  slots: { startsAt: string; timeLabel: string }[];
}

interface Props {
  token: string;
  days: SlotDay[];
  existing: { timeLabel: string } | null;
}

export default function SlotPicker({ token, days, existing }: Props) {
  const router = useRouter();
  const [activeDay, setActiveDay] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ timeLabel: string; calendarUrl: string } | null>(null);
  const [rebooking, setRebooking] = useState(false);

  async function book() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screening/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: selected }),
      });
      const data = (await res.json()) as {
        error?: string;
        timeLabel?: string;
        calendarUrl?: string;
      };
      if (!res.ok) {
        setError(data.error || "That didn't work — try another time.");
        if (res.status === 409) router.refresh();
        return;
      }
      setConfirmed({ timeLabel: data.timeLabel || "", calendarUrl: data.calendarUrl || "" });
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <div className="glass-strong p-8 text-center">
        <span className="chip chip-olive">Confirmed</span>
        <h2 className="display mt-5 text-[26px] leading-[1.15] text-ink">Your call is set.</h2>
        <p className="muted mt-4 text-[15px] leading-relaxed">{confirmed.timeLabel}</p>
        <p className="muted mt-2 text-[14px] leading-relaxed">
          We&apos;ll call you — keep your phone close. A confirmation is on its way
          to your inbox.
        </p>
        {confirmed.calendarUrl && (
          <a
            href={confirmed.calendarUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-glass tap mt-6 inline-flex h-[48px] items-center px-8 text-[14px]"
          >
            Add to calendar
          </a>
        )}
      </div>
    );
  }

  if (existing && !rebooking) {
    return (
      <div className="glass-strong p-8 text-center">
        <span className="chip chip-gold">Scheduled</span>
        <h2 className="display mt-5 text-[26px] leading-[1.15] text-ink">
          Your call is already set.
        </h2>
        <p className="muted mt-4 text-[15px] leading-relaxed">{existing.timeLabel}</p>
        <button
          onClick={() => setRebooking(true)}
          className="btn-glass tap mt-6 inline-flex h-[48px] items-center px-8 text-[14px]"
        >
          Choose a different time
        </button>
      </div>
    );
  }

  if (!days.length) {
    return (
      <div className="glass-strong p-8 text-center">
        <span className="chip">One moment</span>
        <h2 className="display mt-5 text-[26px] leading-[1.15] text-ink">
          The host&apos;s calendar is being arranged.
        </h2>
        <p className="muted mt-4 text-[15px] leading-relaxed">
          No open windows right now. Check back shortly — or reply to your
          email and we&apos;ll find a time together.
        </p>
      </div>
    );
  }

  const day = days[Math.min(activeDay, days.length - 1)];

  return (
    <div className="glass p-6 sm:p-7">
      <p className="tag">Pick a day</p>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => (
          <button
            key={d.dateKey}
            onClick={() => {
              setActiveDay(i);
              setSelected(null);
            }}
            className={`tap pill shrink-0 border px-4 py-2 text-[13px] font-medium transition ${
              i === activeDay
                ? "border-[rgba(228,190,109,0.6)] bg-[rgba(228,190,109,0.16)] text-[#e4be6d]"
                : "border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.07)] text-[rgba(247,251,248,0.75)]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p className="tag mt-5">Pick a time · Ibiza clock</p>
      <div className="grid grid-cols-3 gap-2">
        {day.slots.map((slot) => (
          <button
            key={slot.startsAt}
            onClick={() => setSelected(slot.startsAt)}
            className={`tap rounded-2xl border px-2 py-3 text-[14px] font-medium transition ${
              selected === slot.startsAt
                ? "border-[rgba(228,190,109,0.7)] bg-[rgba(228,190,109,0.2)] text-[#ecd08b]"
                : "border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] text-[rgba(247,251,248,0.85)]"
            }`}
          >
            {slot.timeLabel}
          </button>
        ))}
      </div>

      {error && (
        <p className="chip chip-red mt-5 w-full whitespace-normal py-2 normal-case tracking-normal">
          {error}
        </p>
      )}

      <button
        onClick={book}
        disabled={!selected || loading}
        className="btn-champagne tap mt-6 h-[52px] w-full text-[15px]"
      >
        {loading ? "Confirming…" : selected ? "Confirm this window" : "Choose a time"}
      </button>
      <p className="faint mt-4 text-center text-[12px] leading-relaxed">
        Fifteen minutes, by phone. Times shown on the Ibiza clock.
      </p>
    </div>
  );
}
