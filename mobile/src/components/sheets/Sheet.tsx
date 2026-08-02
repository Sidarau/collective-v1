"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useUiState } from "@/components/shell/UiStateProvider";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hidden titles still label the dialog for assistive technology. */
  hideTitle?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Collecta uses the tall 70–85% variant. */
  variant?: "auto" | "collecta";
  testId?: string;
};

/**
 * Base bottom sheet.
 *
 * Traps focus while open and restores it to the opener on close. Opening a
 * sheet raises the shell's focus depth, which is what blurs and darkens the
 * wallpaper behind the glass — scroll position is preserved throughout.
 */
export function Sheet({
  open,
  onClose,
  title,
  hideTitle,
  children,
  footer,
  variant = "auto",
  testId,
}: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const { pushFocus, popFocus } = useUiState();

  /* Callers pass inline `onClose` closures, so the prop changes identity on
     every parent render. Keep it in a ref: the focus effect below must run
     only when `open` flips — re-running it on a parent re-render re-focuses
     the panel and rips focus out of the sheet's inputs, which on iOS kills
     the software keyboard the moment it opens (a scroll event fires as the
     keyboard appears → shell re-renders → effect re-runs → input blurs). */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    pushFocus();
    return () => popFocus();
  }, [open, pushFocus, popFocus]);

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the panel itself so screen readers announce the sheet title first.
    panel?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey && (activeEl === first || activeEl === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Restore focus to whatever opened the sheet.
      openerRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`sheet${variant === "collecta" ? " sheet--collecta" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId ?? "sheet"}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <div className="sheet__head">
          <h2 id={titleId} className={hideTitle ? "sr-only" : "sheet__title"}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__foot">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}
