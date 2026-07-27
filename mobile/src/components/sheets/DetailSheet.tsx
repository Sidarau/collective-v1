"use client";

import Link from "next/link";
import { iconFor } from "@/lib/icons";
import { StatusPill } from "@/components/ui/primitives";
import type { RecordState } from "@/data/contracts";
import { Sheet } from "./Sheet";

/** Queue row preview. May promote to a full route via "View details". */
export function DetailSheet({
  open,
  onClose,
  title,
  state,
  facts,
  href,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  state?: RecordState;
  facts: { icon?: string; label: string; value: string }[];
  href?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      testId="detail-sheet"
      footer={
        actions ?? (
          href ? (
            <Link href={href} className="btn btn--primary btn--block">
              View details
            </Link>
          ) : undefined
        )
      }
    >
      {state ? (
        <p style={{ margin: "0 0 12px" }}>
          <StatusPill label={state.label} tone={state.tone} />
        </p>
      ) : null}

      <ul className="facts">
        {facts.map((f) => {
          const Icon = f.icon ? iconFor(f.icon) : null;
          return (
            <li className="facts__item" key={`${f.label}-${f.value}`}>
              <span className="facts__label">
                {Icon ? <Icon size={17} strokeWidth={1.6} aria-hidden="true" /> : null}
                {f.label}
              </span>
              <span className="facts__value">{f.value}</span>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** One task per sheet: select a value and close. */
export function PickerSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  value,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: { value: T; label: string; detail?: string }[];
  value?: T;
  onSelect: (v: T) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} testId="picker-sheet">
      <ul className="list" role="listbox" aria-label={title}>
        {options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              role="option"
              aria-selected={value === o.value}
              className={`row${value === o.value ? " row--selected" : ""}`}
              onClick={() => {
                onSelect(o.value);
                onClose();
              }}
            >
              <span className="row__body">
                <span className="row__title">{o.label}</span>
                {o.detail ? <span className="row__detail">{o.detail}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
