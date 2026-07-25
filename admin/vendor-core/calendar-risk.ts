export type CalendarRiskOperation = "create" | "update" | "cancel";

export interface CalendarRiskEvent {
  summary?: string;
  startIso?: string;
  endIso?: string;
  attendees?: string[];
}

export interface CalendarPreviewInput {
  operation: CalendarRiskOperation;
  eventId?: string;
  event: CalendarRiskEvent;
}

export function classifyCalendarActionRisk(
  operation: CalendarRiskOperation,
  event: CalendarRiskEvent
): "low" | "high" {
  if (operation !== "create") return "high";
  if (event.attendees?.length) return "high";
  if (!event.startIso || !event.endIso || !event.summary?.trim()) return "high";
  if (new Date(event.startIso).getTime() <= Date.now()) return "high";
  return "low";
}

export function calendarActionPreview(input: CalendarPreviewInput): string {
  const title = input.event.summary?.trim() || input.eventId || "calendar event";
  const when = input.event.startIso
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(input.event.startIso))
    : "the existing time";
  if (input.operation === "create") return `Create “${title}” at ${when}`;
  if (input.operation === "update") return `Change “${title}” (${input.eventId})`;
  return `Cancel “${title}” (${input.eventId})`;
}
