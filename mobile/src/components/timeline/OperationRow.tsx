"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import type { OperationEvent } from "@/data/contracts";
import { Icon } from "@/lib/icons";
import { displayTime, formatDayShort, rowTimeLabel } from "@/lib/time";
import { rowStateClass, trailingFor } from "@/lib/presentation";

/**
 * One operational event.
 *
 * A clock time renders only when `displayPrecision` is "minute" — applications,
 * approvals, upkeep, supplies, notes and dues never show an invented time.
 */
export function OperationRow({
  event,
  focused = false,
  onSelect,
}: {
  event: OperationEvent;
  focused?: boolean;
  onSelect?: (event: OperationEvent) => void;
}) {
  const time = displayTime(event.sortAt, event.displayPrecision);
  const dayOnly = event.displayPrecision === "day" ? formatDayShort(event.sortAt) : null;
  const trailing = trailingFor(event);
  const Arrow = trailing.arrow === "down" ? ArrowDown : ArrowUp;

  return (
    <li>
      <Link
        href={event.href}
        className={rowStateClass(event, focused)}
        data-testid="operation-row"
        data-event-id={event.id}
        data-category={event.category}
        data-status={event.status}
        data-precision={event.displayPrecision}
        data-iso={event.sortAt}
        aria-current={focused ? "true" : undefined}
        onClick={() => onSelect?.(event)}
      >
        {time || dayOnly ? (
          <span className="op-row__time" aria-hidden="true">
            {time ?? dayOnly}
          </span>
        ) : null}

        {/* Completed history collapses the disc to a quiet dot (CSS). */}
        <span className="op-row__node" aria-hidden="true">
          {event.status === "complete" ? null : (
            <Icon name={event.kind} size={14} strokeWidth={1.7} />
          )}
        </span>

        <span className="op-row__body">
          <span className="op-row__title">{event.title}</span>
          {event.detail ? <span className="op-row__detail">{event.detail}</span> : null}
          {event.carriedFrom ? (
            <span className="carried-flag">
              <Check size={11} aria-hidden="true" />
              Carried from {formatDayShort(`${event.carriedFrom}T12:00:00Z`)}
            </span>
          ) : null}
        </span>

        <span className={`op-row__trailing status--${trailing.tone}`}>
          <span aria-hidden="true">
            {trailing.label}
            {trailing.arrow ? (
              <Arrow
                size={13}
                style={{ display: "inline", verticalAlign: "-2px", marginLeft: 3 }}
              />
            ) : null}
          </span>
        </span>

        {/* One sentence carries title, state, day and time for assistive tech. */}
        <span className="sr-only">
          {`${event.title}. ${event.detail ?? ""} ${trailing.announcement}. ${formatDayShort(
            event.sortAt,
          )}, ${rowTimeLabel(event.sortAt, event.displayPrecision)}.${
            event.carriedFrom ? " Carried forward from an earlier day." : ""
          }`}
        </span>
      </Link>
    </li>
  );
}
