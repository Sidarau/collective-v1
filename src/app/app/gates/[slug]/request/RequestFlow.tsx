"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DateRangeCalendar from "@/components/DateRangeCalendar";

interface GateInfo {
  name: string;
  slug: string;
  location: string;
}

interface AvailableRoom {
  id: string;
  slug: string;
  name: string;
  bed_type: string | null;
  image: string | null;
  nights: number;
  price_per_night: number; // cents
  total: number; // cents
  currency: string;
}

interface Props {
  gate: GateInfo;
  initialFrom: string | null;
  initialTo: string | null;
  preferredRoom: string | null;
}

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${iso}T12:00:00Z`)
  );

export default function RequestFlow({ gate, initialFrom, initialTo, preferredRoom }: Props) {
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [withCompanion, setWithCompanion] = useState(false);
  const [companionName, setCompanionName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);

  const loadAvailability = useCallback(async (f: string, t: string) => {
    setChecking(true);
    setError(null);
    setRooms(null);
    setRoomId(null);
    try {
      const res = await fetch(
        `/api/availability?gate=${gate.slug}&from=${f}&to=${t}`
      );
      const data = (await res.json()) as { rooms?: AvailableRoom[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not check availability.");
        return;
      }
      setRooms(data.rooms || []);
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setChecking(false);
    }
  }, [gate.slug]);

  useEffect(() => {
    if (!from || !to) return;
    const timer = window.setTimeout(() => {
      void loadAvailability(from, to);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [from, to, loadAvailability]);

  // Preselect room coming from a room card once availability arrives.
  useEffect(() => {
    if (!rooms || !preferredRoom || roomId) return;
    const match = rooms.find((r) => r.slug === preferredRoom);
    if (!match) return;
    const timer = window.setTimeout(() => setRoomId(match.id), 0);
    return () => window.clearTimeout(timer);
  }, [rooms, preferredRoom, roomId]);

  async function joinWaitlist() {
    if (!from || !to) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateSlug: gate.slug,
          from,
          to,
          waitlist: true,
          notes: notes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not join the waiting list.");
        return;
      }
      setWaitlisted(true);
      setDone(true);
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!from || !to || !roomId) return;
    if (withCompanion && !companionName.trim()) {
      setError("Add your guest's name — or switch back to coming alone.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateSlug: gate.slug,
          roomId,
          from,
          to,
          companionName: withCompanion ? companionName.trim() : null,
          notes: notes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send your request.");
        return;
      }
      setDone(true);
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="glass-strong reveal w-full max-w-sm p-8">
          <span className="chip chip-olive">{waitlisted ? "On the waiting list" : "Request sent"}</span>
          <h1 className="display mt-4 text-[28px] leading-tight text-ink">
            {waitlisted ? "You're on the list." : "The host has your window."}
          </h1>
          <p className="muted mt-3 text-[14px] leading-relaxed">
            {waitlisted
              ? `${fmtDay(from!)} → ${fmtDay(to!)} at ${gate.name}. If those nights open, you're the first call.`
              : `${fmtDay(from!)} → ${fmtDay(to!)} at ${gate.name}. You'll hear back once it's confirmed — usually within a day.`}
          </p>
          <Link href="/app" className="btn-champagne tap mt-6 inline-flex h-12 items-center px-8 text-[14px]">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  const selected = rooms?.find((r) => r.id === roomId);

  return (
    <div className="px-5 pb-10 pt-14">
      <header className="reveal flex items-center gap-3">
        <Link
          href={`/app/gates/${gate.slug}`}
          className="btn-glass tap flex h-10 w-10 items-center justify-center text-[16px]"
          aria-label="Back"
        >
          ‹
        </Link>
        <div>
          <p className="eyebrow">Request a window</p>
          <h1 className="display text-[24px] leading-tight text-ink">{gate.name}</h1>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        <section className="reveal" style={{ animationDelay: "0.06s" }}>
          <p className="tag mb-2 px-1">
            {!from ? "Choose your arrival" : !to ? "…and your departure" : `${fmtDay(from)} → ${fmtDay(to)}`}
          </p>
          <DateRangeCalendar
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              if (!t) setRooms(null);
            }}
          />
        </section>

        {checking && (
          <p className="muted reveal px-1 text-[13px]">Checking the house…</p>
        )}

        {rooms && rooms.length === 0 && (
          <div className="glass reveal p-5">
            <p className="text-[15px] font-semibold text-ink">The house is full for those dates.</p>
            <p className="muted mt-1 text-[13px]">
              Shift your window a few days — or put your name down and the host calls you first
              if a room opens.
            </p>
            <button
              type="button"
              onClick={joinWaitlist}
              disabled={submitting}
              className="btn-champagne tap mt-4 h-12 w-full text-[14px]"
            >
              {submitting ? "Sending…" : "Join the waiting list"}
            </button>
          </div>
        )}

        {rooms && rooms.length > 0 && (
          <section className="stagger space-y-3">
            <p className="tag px-1">
              {rooms.length} room{rooms.length > 1 ? "s" : ""} free for your window
            </p>
            {rooms.map((room) => {
              const active = room.id === roomId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setRoomId(room.id)}
                  className={`tap flex w-full gap-4 overflow-hidden p-3 text-left ${
                    active ? "glass-strong ring-1 ring-champagne/70" : "glass"
                  }`}
                >
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl">
                    {room.image && (
                      <Image src={room.image} alt={room.name} fill sizes="96px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <p className="text-[15px] font-semibold text-ink">{room.name}</p>
                    <p className="muted text-[12px]">
                      {room.bed_type || "Double"} · {room.nights} night{room.nights > 1 ? "s" : ""}
                    </p>
                    <p className="mt-0.5 text-[13px] text-champagne">Member window</p>
                  </div>
                  <span
                    className={`self-center rounded-full border px-2 py-2 ${
                      active ? "border-champagne bg-champagne" : "border-white/25"
                    }`}
                  />
                </button>
              );
            })}
          </section>
        )}

        {selected && (
          <section className="glass reveal space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-semibold text-ink">Bringing someone?</p>
                <p className="muted text-[12px]">Each room hosts you plus one guest.</p>
              </div>
              <button
                type="button"
                onClick={() => setWithCompanion((v) => !v)}
                className={`pill tap h-8 w-14 border transition ${
                  withCompanion ? "border-champagne bg-champagne/90" : "border-white/25 bg-white/10"
                }`}
                aria-pressed={withCompanion}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-ink transition ${
                    withCompanion ? "ml-7" : "ml-1"
                  }`}
                />
              </button>
            </div>

            {withCompanion && (
              <div>
                <label className="tag">Your guest&apos;s name</label>
                <input
                  className="field"
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  placeholder="First and last name"
                />
              </div>
            )}

            <div>
              <label className="tag">A note for the host (optional)</label>
              <textarea
                className="field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Arrival time, occasions, anything the house should know"
              />
            </div>
          </section>
        )}

        {error && (
          <p className="notice notice-red w-full py-2">{error}</p>
        )}

        {selected && (
          <button
            onClick={submit}
            disabled={submitting}
            className="btn-champagne tap h-[54px] w-full text-[15px]"
          >
            {submitting
              ? "Sending…"
              : `Request ${fmtDay(from!)} → ${fmtDay(to!)}`}
          </button>
        )}
      </div>
    </div>
  );
}
