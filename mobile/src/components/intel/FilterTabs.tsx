"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type TabOption<T extends string> = { key: T; label: string };

/**
 * Text tabs with one travelling rule. Uses real tab semantics so assistive
 * technology reports position, and the selected key lives in URL state so a
 * filter survives navigation and reload.
 */
export function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  resultCount,
  resultNoun = "items",
}: {
  label: string;
  options: TabOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Announced politely so a filter change is perceivable without sight. */
  resultCount?: number;
  resultNoun?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [rule, setRule] = useState({ left: 0, width: 0 });

  const measure = () => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) return;
    setRule({ left: active.offsetLeft, width: active.offsetWidth });
  };

  useLayoutEffect(measure, [value, options]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.key === value);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(options[(i + 1) % options.length].key);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(options[(i - 1 + options.length) % options.length].key);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(options[0].key);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(options[options.length - 1].key);
    }
  };

  return (
    <>
      <div
        ref={listRef}
        className="filter-tabs"
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        data-testid="filter-tabs"
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="tab"
            id={`tab-${o.key}`}
            className="filter-tab"
            aria-selected={o.key === value}
            aria-controls={`panel-${o.key}`}
            tabIndex={o.key === value ? 0 : -1}
            onClick={() => onChange(o.key)}
            data-testid={`filter-tab-${o.key}`}
          >
            {o.label}
          </button>
        ))}
        <span
          className="filter-tabs__rule"
          aria-hidden="true"
          style={{ width: rule.width, transform: `translateX(${rule.left}px)` }}
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {typeof resultCount === "number"
          ? `${resultCount} ${resultNoun} in ${
              options.find((o) => o.key === value)?.label ?? value
            }`
          : ""}
      </p>
    </>
  );
}
