"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type UiState = {
  /** > 0 while any sheet, detail overlay or Collecta is open. */
  focusDepth: number;
  pushFocus: () => void;
  popFocus: () => void;
  /** True while the page is being scrolled; floating controls retire. */
  isScrolling: boolean;
  /** The date currently visible in the future timeline; seeds the add flow. */
  visibleDate: string | null;
  setVisibleDate: (iso: string | null) => void;
  /** Ids currently on screen — Collecta receives ids, never record bodies. */
  visibleEventIds: string[];
  setVisibleEventIds: (ids: string[]) => void;
  prefersReducedMotion: boolean;
};

const Ctx = createContext<UiState | null>(null);

export function useUiState(): UiState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUiState must be used inside <UiStateProvider>");
  return ctx;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function UiStateProvider({ children }: { children: React.ReactNode }) {
  const [focusDepth, setFocusDepth] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [visibleDate, setVisibleDate] = useState<string | null>(null);
  const [visibleEventIds, setVisibleEventIds] = useState<string[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const restTimer = useRef<number | undefined>(undefined);

  const pushFocus = useCallback(() => setFocusDepth((d) => d + 1), []);
  const popFocus = useCallback(() => setFocusDepth((d) => Math.max(0, d - 1)), []);

  /* Floating controls retire while scrolling and return after rest. */
  useEffect(() => {
    if (prefersReducedMotion) return;
    const onScroll = () => {
      setIsScrolling((was) => (was ? was : true));
      window.clearTimeout(restTimer.current);
      restTimer.current = window.setTimeout(() => setIsScrolling(false), 420);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(restTimer.current);
    };
  }, [prefersReducedMotion]);

  /* A sheet must not let the page behind it scroll away underneath. */
  useEffect(() => {
    if (focusDepth > 0) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [focusDepth]);

  const value = useMemo<UiState>(
    () => ({
      focusDepth,
      pushFocus,
      popFocus,
      isScrolling,
      visibleDate,
      setVisibleDate,
      visibleEventIds,
      setVisibleEventIds,
      prefersReducedMotion,
    }),
    [
      focusDepth,
      pushFocus,
      popFocus,
      isScrolling,
      visibleDate,
      visibleEventIds,
      prefersReducedMotion,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
