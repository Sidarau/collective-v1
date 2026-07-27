"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RecordState } from "@/data/contracts";
import { Icon } from "@/lib/icons";

/* ------------------------------------------------------------------ *
 * Status — always text, never colour alone
 * ------------------------------------------------------------------ */

const toneClass = (tone: RecordState["tone"]) => `status--${tone}`;

/** Default list-row trailing state. */
export function StatusText({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: RecordState["tone"];
}) {
  return <span className={`status ${toneClass(tone)}`}>{label}</span>;
}

/** Detail headers and confirmation sheets — not every list row. */
export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: RecordState["tone"];
}) {
  return (
    <span className={`status-pill ${toneClass(tone)}`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Compact presence. Always paired with text elsewhere in the row. */
export function StatusDot({ tone = "neutral" }: { tone?: RecordState["tone"] }) {
  return <span className={`status-dot ${toneClass(tone)}`} aria-hidden="true" />;
}

/** Actionable counts only. */
export function CountBadge({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <span className="count-badge tnum">
      <span className="sr-only">{`${count} ${label}`}</span>
      <span aria-hidden="true">{count}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons — one champagne primary action per viewport
 * ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  block?: boolean;
};

export function PrimaryButton({ block, className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn btn--primary${block ? " btn--block" : ""} ${className}`.trim()}
    />
  );
}

export function SecondaryButton({ block, className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn btn--secondary${block ? " btn--block" : ""} ${className}`.trim()}
    />
  );
}

export function DestructiveButton({ block, className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn btn--destructive${block ? " btn--block" : ""} ${className}`.trim()}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

export function Banner({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "success" | "error";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const icon = tone === "success" ? "circle-check" : tone === "error" ? "circle-alert" : "info";
  return (
    <div className={`banner banner--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} size={18} />
      <span style={{ flex: 1 }}>{children}</span>
      {action}
    </div>
  );
}

/** Reversible low-risk writes only — never money, access or publishing. */
export function UndoToast({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="btn btn--quiet" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Empty / loading / error
 * ------------------------------------------------------------------ */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__body">{body}</p>
      {action}
    </div>
  );
}

/** Preserves the final row geometry so nothing shifts on load. */
export function SkeletonRow({ withMedia = true }: { withMedia?: boolean }) {
  return (
    <li className="skeleton-row" aria-hidden="true">
      {withMedia ? (
        <span className="skeleton" style={{ width: 38, height: 38, borderRadius: 999 }} />
      ) : null}
      <span style={{ flex: 1, display: "grid", gap: 6 }}>
        <span className="skeleton" style={{ width: "58%", height: 15 }} />
        <span className="skeleton" style={{ width: "38%", height: 12 }} />
      </span>
      <span className="skeleton" style={{ width: 54, height: 12 }} />
    </li>
  );
}

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Generic navigation row
 * ------------------------------------------------------------------ */

export function NavRow({
  href,
  icon,
  label,
  detail,
  badge,
  trailing,
}: {
  href?: string;
  icon?: string;
  label: string;
  detail?: string;
  badge?: number;
  trailing?: React.ReactNode;
}) {
  const body = (
    <>
      {icon ? (
        <span className="row__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <span className="row__body">
        <span className="row__title">{label}</span>
        {detail ? <span className="row__detail">{detail}</span> : null}
      </span>
      <span className="row__trailing">
        {trailing}
        {badge ? <CountBadge count={badge} label={`open in ${label}`} /> : null}
        <ChevronRight size={18} className="row__chev" aria-hidden="true" />
      </span>
    </>
  );

  if (!href) {
    return (
      <li>
        <button type="button" className="row">
          {body}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} className="row">
        {body}
      </Link>
    </li>
  );
}
