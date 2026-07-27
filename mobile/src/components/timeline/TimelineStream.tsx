"use client";

/* The landing effect intentionally has no "already landed" ref guard: under
   StrictMode the effect is mounted, cleaned up and mounted again, and a ref
   guard would let the cancelled first pass suppress the real second one. The
   dependency list is what keeps it from re-running. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OperationEvent } from "@/data/contracts";
import { dayLabel, isoDay } from "@/lib/time";
import { useUiState } from "@/components/shell/UiStateProvider";
import { OperationRow } from "./OperationRow";

/** Fired by the bottom rail when Today is tapped while already on Today. */
export const RETURN_TO_PRESENT_EVENT = "collective:return-to-present";

type Props = {
  events: OperationEvent[];
  nowIso: string;
  /** Today is the only bidirectional stream; other screens pass false. */
  bidirectional?: boolean;
  emptyState?: React.ReactNode;
};

/**
 * One continuous chronology. History sits above the present, plans below, and
 * the view lands with the present around 38% of the viewport.
 */
export function TimelineStream({
  events,
  nowIso,
  bidirectional = true,
  emptyState,
}: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const nowRef = useRef<HTMLLIElement>(null);
  const [pulse, setPulse] = useState(false);
  const { setVisibleDate, setVisibleEventIds, prefersReducedMotion } = useUiState();

  const now = Date.parse(nowIso);

  /* Where the present sits in the ordered list. */
  const presentAt = useMemo(() => {
    const idx = events.findIndex((e) => !e.carriedFrom && Date.parse(e.sortAt) >= now);
    return idx === -1 ? events.length : idx;
  }, [events, now]);

  /* Exactly one luminous item per viewport: the next decision needing one. */
  const focusedId = useMemo(() => {
    const candidates = events.slice(presentAt);
    const decision = candidates.find((e) => e.status === "review" || e.status === "confirm");
    return (decision ?? candidates[0])?.id ?? null;
  }, [events, presentAt]);

  const landOnPresent = useCallback(
    (smooth: boolean) => {
      const marker = nowRef.current;
      if (!marker) return;
      const rect = marker.getBoundingClientRect();
      const target = window.scrollY + rect.top - window.innerHeight * 0.38;

      // Proximity snap would pull an anchored scroll back to the nearest day
      // divider. Snap belongs to the operator's own scrolling, not to ours.
      const root = document.documentElement;
      const previousSnap = root.style.scrollSnapType;
      root.style.scrollSnapType = "none";

      window.scrollTo({
        top: Math.max(0, target),
        behavior: smooth && !prefersReducedMotion ? "smooth" : "auto",
      });

      const restore = () => {
        root.style.scrollSnapType = previousSnap;
      };
      if (smooth && !prefersReducedMotion) window.setTimeout(restore, 500);
      else requestAnimationFrame(restore);
    },
    [prefersReducedMotion],
  );

  /* Land near the present on first paint and whenever the filter changes.
     The veil is measured and the display face swaps in after first paint, and
     both change the height of everything above the present — so a single
     measurement lands short. Re-assert until the marker is within a few pixels
     of the anchor, bounded, and abandon the moment the operator scrolls. */
  useEffect(() => {
    if (!bidirectional) return;

    let attempts = 0;
    let timer = 0;

    /* Re-assert on a short interval rather than on consecutive frames: the
       veil measurement, the display-face swap and the router's own post-
       hydration scroll handling all land after the first frames, and each of
       them moves everything above the present. */
    const settle = () => {
      const marker = nowRef.current;
      if (!marker) return stop();
      const drift = Math.abs(
        marker.getBoundingClientRect().top - window.innerHeight * 0.38,
      );
      if (drift <= 12 || attempts >= 10) return stop();
      attempts += 1;
      landOnPresent(false);
    };

    // Any deliberate input wins over the initial anchor, immediately.
    const release = () => stop();
    function stop() {
      if (timer) window.clearInterval(timer);
      timer = 0;
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    }

    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);

    landOnPresent(false);
    timer = window.setInterval(settle, 120);

    return stop;
  }, [bidirectional, landOnPresent, events]);

  /* Today tap returns to the present without clearing filters. */
  useEffect(() => {
    const handler = () => {
      landOnPresent(true);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 700);
    };
    window.addEventListener(RETURN_TO_PRESENT_EVENT, handler);
    return () => window.removeEventListener(RETURN_TO_PRESENT_EVENT, handler);
  }, [landOnPresent]);

  /* Track what is on screen: the visible future date seeds the add flow, and
     the visible ids are what Collecta receives (ids only, never bodies). */
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.eventId;
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const ids = events.filter((e) => visible.has(e.id)).map((e) => e.id);
        setVisibleEventIds(ids);

        const future = ids
          .map((id) => events.find((e) => e.id === id))
          .filter((e): e is OperationEvent => Boolean(e))
          .filter((e) => Date.parse(e.sortAt) >= now);
        setVisibleDate(future.length ? isoDay(future[future.length - 1].sortAt) : null);
      },
      { rootMargin: "-20% 0px -30% 0px", threshold: 0 },
    );

    list.querySelectorAll("[data-event-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [events, now, setVisibleDate, setVisibleEventIds]);

  if (!events.length) return <>{emptyState}</>;

  const nowMarker = (
    <li
      key="now-marker"
      ref={nowRef}
      className="now-marker"
      data-pulse={pulse ? "true" : "false"}
      data-testid="now-marker"
      id="present"
    >
      <span className="now-marker__pip" aria-hidden="true" />
      <span className="now-marker__label">Now</span>
      <span className="now-marker__line" aria-hidden="true" />
    </li>
  );

  /* A flat list of <li> children keeps the ordered-list semantics valid. */
  const items: React.ReactNode[] = [];
  let lastDay = "";
  let carriedLabelled = false;

  events.forEach((event, index) => {
    const isCarried = Boolean(event.carriedFrom) && event.status !== "complete";

    if (bidirectional && index === presentAt) items.push(nowMarker);

    if (isCarried) {
      // Overdue work is grouped just above the present, not filed under the
      // day it was originally due — so it gets its own label, not a date.
      if (!carriedLabelled) {
        carriedLabelled = true;
        items.push(
          <li key="carried-divider" className="day-divider">
            Carried forward
          </li>,
        );
      }
    } else {
      const day = isoDay(event.sortAt);
      if (day !== lastDay) {
        lastDay = day;
        items.push(
          <li key={`day-${day}-${index}`} className="day-divider">
            {dayLabel(event.sortAt, nowIso)}
          </li>,
        );
      }
    }

    items.push(
      <OperationRow key={event.id} event={event} focused={event.id === focusedId} />,
    );
  });

  // Everything is in the past: the marker still anchors the end of the stream.
  if (bidirectional && presentAt >= events.length) items.push(nowMarker);

  return (
    <ol className="timeline" ref={listRef} data-testid="timeline">
      {items}
    </ol>
  );
}
