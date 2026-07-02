"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DateRangeCalendar, { type DayMark } from "@/components/DateRangeCalendar";

export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: string;
  startAt: string;
  endAt: string | null;
  image: string | null;
  capacity: number | null;
  gateName: string | null;
  gateSlug: string | null;
  myRsvp: string | null;
  attendees: { userId: string; name: string; headline: string | null }[];
}

export interface PresenceEntry {
  from: string;
  to: string;
  name: string;
  userId: string | null;
  withCompanion: boolean;
}

interface Props {
  gateName: string;
  gateSlug: string;
  totalRooms: number;
  events: CalendarEvent[];
  presence: PresenceEntry[];
  freeRooms: Record<string, number>;
  openEventSlug: string | null;
}

const fmtLong = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const fmtShort = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  );

export default function CalendarView({
  gateName,
  gateSlug,
  totalRooms,
  events,
  presence,
  freeRooms,
  openEventSlug,
}: Props) {
  const router = useRouter();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<string | null>(
    openEventSlug ? events.find((e) => e.slug === openEventSlug)?.id || null : null
  );
  const [rsvping, setRsvping] = useState<string | null>(null);
  const [localRsvps, setLocalRsvps] = useState<Record<string, string>>({});

  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {};
    for (const ev of events) {
      const day = ev.startAt.slice(0, 10);
      m[day] = { ...m[day], events: (m[day]?.events || 0) + 1 };
    }
    for (const p of presence) {
      const start = new Date(`${p.from}T00:00:00Z`);
      const end = new Date(`${p.to}T00:00:00Z`);
      for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.toISOString().slice(0, 10);
        m[day] = { ...m[day], presence: (m[day]?.presence || 0) + 1 };
      }
    }
    for (const [day, free] of Object.entries(freeRooms)) {
      if (free === 0) m[day] = { ...m[day], full: true };
    }
    return m;
  }, [events, presence, freeRooms]);

  async function rsvp(eventId: string, status: "going" | "declined") {
    setRsvping(eventId);
    try {
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, status }),
      });
      if (res.ok) {
        setLocalRsvps((r) => ({ ...r, [eventId]: status }));
        router.refresh();
      }
    } finally {
      setRsvping(null);
    }
  }

  const rangeChosen = from && to;
  const visibleEvents = events.filter((ev) => {
    if (!rangeChosen) return true;
    const day = ev.startAt.slice(0, 10);
    return day >= from! && day <= to!;
  });

  const overlapping = rangeChosen
    ? presence.filter((p) => p.from < to! && p.to > from!)
    : [];

  return (
    <div className="px-5 pb-10 pt-14">
      <header className="reveal">
        <p className="eyebrow">Calendar</p>
        <h1 className="display mt-2 text-[32px] leading-tight text-ink">
          The season at {gateName}
        </h1>
        <p className="muted mt-2 text-[14px]">
          <span className="mr-3 inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-champagne" /> events
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-olive" /> members present
          </span>
        </p>
      </header>

      <div className="reveal mt-5" style={{ animationDelay: "0.08s" }}>
        <DateRangeCalendar from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} marks={marks} />
      </div>

      {rangeChosen && (
        <div className="glass-strong reveal mt-4 p-5">
          <p className="text-[15px] font-semibold text-ink">
            {fmtShort(from!)} → {fmtShort(to!)}
          </p>
          <p className="muted mt-1 text-[13px]">
            {overlapping.length > 0
              ? `${overlapping.length} member window${overlapping.length > 1 ? "s" : ""} overlap yours: ${overlapping
                  .slice(0, 3)
                  .map((o) => o.name.split(" ")[0])
                  .join(", ")}${overlapping.length > 3 ? "…" : ""}`
              : "A quiet window — the house to yourselves."}
          </p>
          <button
            onClick={() => router.push(`/app/gates/${gateSlug}/request?from=${from}&to=${to}`)}
            className="btn-champagne tap mt-4 h-12 w-full text-[14px]"
          >
            Request these dates
          </button>
        </div>
      )}

      {/* Who's at the gate */}
      {presence.length > 0 && !rangeChosen && (
        <section className="reveal mt-6" style={{ animationDelay: "0.12s" }}>
          <h2 className="eyebrow mb-3 px-1">Member windows</h2>
          <div className="glass divide-y divide-white/8 p-2">
            {presence.slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive/25 text-[13px] font-semibold text-olive">
                    {p.name[0]}
                  </span>
                  <div>
                    <p className="text-[14px] font-medium text-ink">
                      {p.name}
                      {p.withCompanion ? " +1" : ""}
                    </p>
                  </div>
                </div>
                <p className="muted text-[12px]">
                  {fmtShort(p.from)} – {fmtShort(p.to)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Events */}
      <section className="mt-6">
        <h2 className="eyebrow mb-3 px-1">
          {rangeChosen ? "In your window" : "Upcoming"}
        </h2>
        {visibleEvents.length === 0 && (
          <p className="muted glass-flat p-4 text-[13px]">Nothing scheduled here yet.</p>
        )}
        <div className="stagger space-y-3">
          {visibleEvents.map((ev) => {
            const open = openEvent === ev.id;
            const myStatus = localRsvps[ev.id] || ev.myRsvp;
            const going = ev.attendees.length;
            return (
              <div key={ev.id} className="glass overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenEvent(open ? null : ev.id)}
                  className="tap flex w-full items-stretch gap-4 p-3 text-left"
                >
                  <div className="glass-flat flex w-14 shrink-0 flex-col items-center justify-center py-2">
                    <span className="eyebrow">{new Date(ev.startAt).toLocaleString("en-GB", { month: "short" })}</span>
                    <span className="display text-[22px] leading-none text-ink">
                      {new Date(ev.startAt).getDate()}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <p className="text-[15px] font-semibold text-ink">{ev.title}</p>
                    <p className="muted mt-0.5 text-[12px]">
                      {ev.gateName} · {new Date(ev.startAt).toLocaleString("en-GB", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-center gap-1 pr-1">
                    <span className={`chip ${myStatus === "going" ? "chip-olive" : "chip-gold"}`}>
                      {myStatus === "going" ? "Going" : `${going || ev.attendees.length} going`}
                    </span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-white/10 p-4">
                    {ev.image && (
                      <div className="relative mb-4 h-36 overflow-hidden rounded-2xl">
                        <Image src={ev.image} alt="" fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
                      </div>
                    )}
                    <p className="muted text-[13px]">{fmtLong(ev.startAt)}</p>
                    {ev.description && (
                      <p className="mt-2 text-[14px] leading-relaxed text-ink/85">{ev.description}</p>
                    )}
                    {ev.attendees.length > 0 && (
                      <div className="mt-4">
                        <p className="tag">Who&apos;s going</p>
                        <div className="space-y-1.5">
                          {ev.attendees.map((a) => (
                            <p key={a.userId} className="text-[13px] text-ink/85">
                              {a.name}
                              {a.headline ? <span className="muted"> — {a.headline}</span> : null}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      {myStatus === "going" ? (
                        <button
                          onClick={() => rsvp(ev.id, "declined")}
                          disabled={rsvping === ev.id}
                          className="btn-glass tap h-11 flex-1 text-[13px]"
                        >
                          {rsvping === ev.id ? "…" : "Can't make it"}
                        </button>
                      ) : (
                        <button
                          onClick={() => rsvp(ev.id, "going")}
                          disabled={rsvping === ev.id}
                          className="btn-champagne tap h-11 flex-1 text-[13px]"
                        >
                          {rsvping === ev.id ? "…" : "RSVP — I'm going"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="faint mt-6 px-1 text-center text-[12px]">
        {totalRooms > 0 ? `Days with no free rooms are crossed out.` : ""}
      </p>
    </div>
  );
}
