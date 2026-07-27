"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import type {
  DaySummary as DaySummaryData,
  NumbersOfTheDay,
  NumbersPeriod,
  Result,
  TimelinePage,
} from "@/data/contracts";
import { TODAY_FILTERS, type TodayFilterKey } from "@/lib/routes";
import { DaySummary } from "@/components/intel/DaySummary";
import { NumbersDisclosure } from "@/components/intel/NumbersDisclosure";
import { FilterTabs } from "@/components/intel/FilterTabs";
import {
  RETURN_TO_PRESENT_EVENT,
  TimelineStream,
  splitTimeline,
} from "@/components/timeline/TimelineStream";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { EmptyState } from "@/components/ui/primitives";
import { useUiState } from "@/components/shell/UiStateProvider";

export function TodayClient({
  summary,
  numbers,
  timeline,
  filter,
  nowIso,
}: {
  summary: Result<DaySummaryData>;
  numbers: Record<NumbersPeriod, NumbersOfTheDay>;
  timeline: Result<TimelinePage>;
  filter: TodayFilterKey;
  nowIso: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { prefersReducedMotion } = useUiState();
  const heroRef = useRef<HTMLDivElement>(null);
  const presentRef = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState(false);

  /* Memoised so the empty-result branch does not hand a fresh array to the
     split and the landing effect on every render. */
  const events = useMemo(
    () => (timeline.status === "ok" ? timeline.data.events : []),
    [timeline],
  );
  const { history, present } = useMemo(
    () => splitTimeline(events, nowIso),
    [events, nowIso],
  );

  /* The hero is fixed, so publish its height for the scrolling column to clear
     and keep it current as the numbers panel expands or the face swaps in. */
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--hero-height",
        `${Math.round(hero.getBoundingClientRect().height)}px`,
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(hero);
    // A measurement taken mid-navigation can be wildly wrong and then never
    // change again, so re-publish once the layout has settled.
    const t = window.setTimeout(publish, 400);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  /** Live height of the pinned hero, plus a hairline of breathing room. */
  const heroBottom = () =>
    (heroRef.current?.getBoundingClientRect().height ?? 260) + 6;

  /* Resting position: the present sits directly under the pinned hero, with
     history above it — scroll up for the past, down for what is planned. */
  const landOnPresent = useCallback(
    (smooth: boolean) => {
      const present = presentRef.current;
      if (!present) return;
      // The hero spans from y=0 and already covers the veil, so its own height
      // is the whole chrome — adding the veil again pushes the present down.
      const target = window.scrollY + present.getBoundingClientRect().top - heroBottom();
      window.scrollTo({
        top: Math.max(0, target),
        behavior: smooth && !prefersReducedMotion ? "smooth" : "auto",
      });
    },
    [prefersReducedMotion],
  );

  /* Re-assert on a short interval: the veil measurement and the display-face
     swap both land after first paint and change the height of the history
     above the hero. Any deliberate input hands control back immediately. */
  useEffect(() => {
    if (!history.length) return;
    let attempts = 0;
    let timer = 0;

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = 0;
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    }
    function release() {
      stop();
    }

    const settle = () => {
      const present = presentRef.current;
      if (!present) return stop();
      const drift = Math.abs(present.getBoundingClientRect().top - heroBottom());
      if (drift <= 6 || attempts >= 14) return stop();
      attempts += 1;
      landOnPresent(false);
    };

    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);

    landOnPresent(false);
    timer = window.setInterval(settle, 120);
    return stop;
  }, [history.length, landOnPresent, events]);

  /* Today tap returns to the hero without clearing filters. */
  useEffect(() => {
    const handler = () => {
      landOnPresent(true);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 700);
    };
    window.addEventListener(RETURN_TO_PRESENT_EVENT, handler);
    return () => window.removeEventListener(RETURN_TO_PRESENT_EVENT, handler);
  }, [landOnPresent]);

  /* Filters persist in URL state so a view survives reload and deep links. */
  const setFilter = useCallback(
    (key: TodayFilterKey) => {
      const next = new URLSearchParams(params.toString());
      if (key === "all") next.delete("filter");
      else next.set("filter", key);
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [params, router],
  );

  return (
    <>
      {/* ---- Hero: pinned under the veil, never scrolls away ---- */}
      <div ref={heroRef} className="today-hero" data-testid="today-hero">
        <div className="today-hero__inner">
          <ResultBoundary
            result={summary}
            emptyTitle="No operations today"
            emptyBody="Arrivals, requests and dues will appear here as they are created."
            skeletonRows={3}
          >
          {(data) => (
            <>
              {history.length ? (
                <button
                  type="button"
                  className="history-peek"
                  onClick={() =>
                    window.scrollTo({
                      top: 0,
                      behavior: prefersReducedMotion ? "auto" : "smooth",
                    })
                  }
                  data-testid="history-peek"
                >
                  <ChevronUp size={13} aria-hidden="true" />
                  {history.length} earlier
                </button>
              ) : null}
              <DaySummary summary={data} onFilter={setFilter} />
              <NumbersDisclosure numbers={numbers} />
            </>
          )}
          </ResultBoundary>

          <FilterTabs
            label="Timeline filters"
            options={TODAY_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
            value={filter}
            onChange={setFilter}
            resultCount={events.length}
            resultNoun="operations"
            controlsPanel
          />
        </div>
      </div>

      {/* ---- The chronology: the only thing that scrolls ---- */}
      <div className="today-scroll">
        {history.length ? (
          <section className="history-band" aria-label="Earlier operations">
            <TimelineStream events={history} nowIso={nowIso} mode="history" />
          </section>
        ) : null}

        <div
          ref={presentRef}
          id={`panel-${filter}`}
          role="tabpanel"
          aria-labelledby={`tab-${filter}`}
        >
        <ResultBoundary
          result={timeline}
          emptyTitle="Nothing in this filter"
          emptyBody="Switch to All to see the whole day, or add work with the + control."
        >
          {() => (
            <TimelineStream
              events={present}
              nowIso={nowIso}
              mode="present"
              pulse={pulse}
              emptyState={
                <EmptyState
                  title="Nothing ahead in this filter"
                  body="Switch to All to see the whole day."
                />
              }
            />
            )}
          </ResultBoundary>
        </div>
      </div>
    </>
  );
}
