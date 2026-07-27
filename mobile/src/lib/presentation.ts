/**
 * Row presentation rules.
 *
 * The data contract carries a small `status` enum; the approved boards show a
 * richer trailing label per kind ("Scheduled" for upkeep, "Access details
 * ready" for an arrival). That difference is presentation, so it lives here
 * rather than widening the contract.
 */

import type { OperationEvent, RecordState } from "@/data/contracts";
import { directionLabel } from "./money";

export type Trailing = {
  label: string;
  tone: RecordState["tone"];
  /** Direction arrows are decorative; the word carries the meaning. */
  arrow?: "up" | "down";
  /** Full sentence for assistive technology. */
  announcement: string;
};

const READY_LABEL_BY_KIND: Record<string, string> = {
  arrival: "Access details ready",
  departure: "Ready",
  upkeep: "Scheduled",
  space_reset: "Scheduled",
  experience: "Confirmed",
  supplies: "Scheduled",
  contribution_due: "Due",
  stewardship_due: "Due",
  partner_payment: "Scheduled",
  screening_call: "Scheduled",
};

const BASE_LABEL: Record<OperationEvent["status"], string> = {
  complete: "Completed",
  ready: "Ready",
  in_progress: "In progress",
  confirm: "Needs confirmation",
  review: "Review",
  blocked: "Blocked",
};

const BASE_TONE: Record<OperationEvent["status"], RecordState["tone"]> = {
  complete: "neutral",
  ready: "healthy",
  in_progress: "healthy",
  confirm: "attention",
  review: "critical",
  blocked: "critical",
};

export function trailingFor(event: OperationEvent): Trailing {
  // Money rows announce direction as a word, never as a sign or arrow alone.
  if (event.moneyDirection && event.status !== "complete") {
    const word = directionLabel(event.moneyDirection);
    return {
      label: word,
      tone: event.moneyDirection === "incoming" ? "healthy" : "attention",
      arrow: event.moneyDirection === "incoming" ? "down" : "up",
      announcement: `${word} payment`,
    };
  }

  // A pending decision shows what the operator must do.
  if (event.primaryAction && (event.status === "confirm" || event.status === "review")) {
    const tone = event.status === "review" ? "critical" : "attention";
    return {
      label: event.primaryAction.label,
      tone,
      announcement: `${event.primaryAction.label} — needs a decision`,
    };
  }

  const label =
    event.status === "ready"
      ? (READY_LABEL_BY_KIND[event.kind] ?? BASE_LABEL.ready)
      : BASE_LABEL[event.status];

  return { label, tone: BASE_TONE[event.status], announcement: label };
}

/** Row modifier classes: complete, focused, carried, healthy, blocked. */
export function rowStateClass(event: OperationEvent, focused: boolean): string {
  const parts = ["op-row"];
  if (event.status === "complete") parts.push("op-row--complete");
  if (focused) parts.push("op-row--focused");
  if (event.carriedFrom) parts.push("op-row--carried");
  if (event.status === "blocked") parts.push("op-row--blocked");
  else if (event.status === "in_progress" || event.status === "ready") {
    parts.push("op-row--healthy");
  }
  return parts.join(" ");
}

export function toneFor(state: RecordState): RecordState["tone"] {
  return state.tone;
}
