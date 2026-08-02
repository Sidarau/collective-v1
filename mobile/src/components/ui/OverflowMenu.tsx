"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { iconFor } from "@/lib/icons";

export type OverflowItem = {
  id: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  onSelect?: () => void;
};

/** Rare secondary actions. Never hides the primary action. */
export function OverflowMenu({
  items,
  label = "More actions",
}: {
  items: OverflowItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        data-testid="overflow-trigger"
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 40,
            minWidth: 190,
            borderRadius: "var(--radius-field)",
            border: "1px solid var(--color-line-strong)",
            background: "rgba(10,19,16,.96)",
            backdropFilter: "blur(18px)",
            overflow: "hidden",
          }}
        >
          {items.map((item) => {
            const Icon = item.icon ? iconFor(item.icon) : null;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="row"
                style={{
                  paddingInline: 14,
                  color: item.destructive ? "var(--color-critical)" : undefined,
                }}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {Icon ? <Icon size={17} strokeWidth={1.6} aria-hidden="true" /> : null}
                <span className="row__body">
                  <span className="row__title" style={{ color: "inherit" }}>
                    {item.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
