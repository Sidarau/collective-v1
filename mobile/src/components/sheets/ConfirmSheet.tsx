"use client";

import { iconFor } from "@/lib/icons";
import { PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { Sheet } from "./Sheet";

export type ConfirmFact = { icon?: string; label: string; value: string };

/**
 * Required before money, membership, access, publishing, cancellations and
 * destructive changes. Shows the exact effect in plain language, a quiet
 * Cancel and exactly one champagne Confirm.
 */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  facts,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  facts: ConfirmFact[];
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      testId="confirm-sheet"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onClick={onConfirm}
            disabled={busy}
            data-testid="confirm-action"
            style={destructive ? { background: "var(--color-critical)" } : undefined}
          >
            {busy ? "Working…" : confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <ul className="facts">
        {facts.map((f) => {
          const Icon = f.icon ? iconFor(f.icon) : null;
          return (
            <li className="facts__item" key={f.label}>
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
