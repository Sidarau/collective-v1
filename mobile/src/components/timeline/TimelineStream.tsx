"use client";

import { useEffect, useMemo, useRef } from "react";
import type { OperationEvent } from "@/data/contracts";
import { dayLabel, isoDay } from "@/lib/time";
import { useUiState } from "@/components/shell/UiStateProvider";
import { OperationRow } from "./OperationRow";

/** Fired by the bottom rail when Today is tapped while already on Today. */
export const RETURN_TO_PRESENT_EVENT = "collective:return-to-present";

/**
 * Splits a page of events at the present.
 *
 * History is rendered *above* the hero, so the day opens on Today, the carried
 * block and Now — the past is behind the header and reached by scrolling up.
 * Overdue incomplete work counts as present, never history.
 */
export function splitTimeline(events: OperationEvent[], nowIso: string) {
  const now = Date.parse(nowIso);
  const isCarried = (e: OperationEvent) =>
    Boolean(e.carriedFrom) && e.status !== "complete";

  return {
    history: events.filter((e) => !isCarried(e) && Date.parse(e.sortAt) < now),
    present: events.filter((e) => isCarried(e) || Date.parse(e.sortAt) >= now),
  };
}

type Props = {
  events: OperationEvent[];
  nowIso: string;
  /**
   * "history" renders the past above the hero — faded, and with no present
   * marker. "present" renders the carried block, Now, and everything ahead.
   */
  mode?: "history" | "present";
  emptyState?: React.ReactNode;
  pulse?: boolean;
};

export function TimelineStream({
  events,
  nowIso,
  mode = "present",
  emptyState,
  pulse = false,
}: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const { setVisibleDate, setVisibleEventIds } = useUiState();
  const now = Date.parse(nowIso);
  const isHistory = mode === "history";

  /* Exactly one luminous item per viewport: the next decision that needs one. */
  const focusedId = useMemo(() => {
    if (isHistory) return null;
    const ahead = events.filter((e) => !e.carriedFrom);
    const decision = ahead.find((e) => e.status === "review" || e.status === "confirm");
    return (decision ?? ahead[0])?.id ?? null;
  }, [events, isHistory]);

  /* Track what is on screen: the visible future date seeds the add flow, and
     the visible ids are what Collecta receives (ids only, never bodies). */
  useEffect(() => {
    const list = listRef.current;
    if (!list || isHistory || typeof IntersectionObserver === "undefined") return;

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
      /* Excludes the band under the veil, and only a thin strip above the
         bottom rail — otherwise the final rows never count as visible and
         scrolling into the future would leave the add flow on today. */
      { rootMargin: "-25% 0px -10% 0px", threshold: 0 },
    );

    list.querySelectorAll("[data-event-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [events, now, isHistory, setVisibleDate, setVisibleEventIds]);

  if (!events.length) return <>{emptyState}</>;

  /* A flat list of <li> children keeps the ordered-list semantics valid. */
  const items: React.ReactNode[] = [];
  let lastDay = "";
  let carriedLabelled = false;
  let nowPlaced = false;

  events.forEach((event, index) => {
    const isCarried = Boolean(event.carriedFrom) && event.status !== "complete";

    if (!isHistory && !isCarried && !nowPlaced) {
      nowPlaced = true;
      items.push(
        <li
          key="now-marker"
          className="now-marker"
          data-pulse={pulse ? "true" : "false"}
          data-testid="now-marker"
          id="present"
        >
          <span className="now-marker__pip" aria-hidden="true" />
          <span className="now-marker__label">Now</span>
          <span className="now-marker__line" aria-hidden="true" />
        </li>,
      );
    }

    if (isCarried) {
      // Overdue work is grouped just above the present, not filed under the
      // day it was originally due — so it gets its own label, not a date.
      if (!carriedLabelled) {
        carriedLabelled = true;
        items.push(
          <li key="carried-divider" className="day-divider day-divider--carried">
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

  return (
    <ol
      className={`timeline${isHistory ? " timeline--history" : ""}`}
      ref={listRef}
      data-testid={isHistory ? "timeline-history" : "timeline"}
      aria-label={isHistory ? "Earlier operations" : "Operations from now onwards"}
    >
      {items}
    </ol>
  );
}
