/**
 * The six composer kinds — pure constant, shared by the client shell and
 * both providers. Lives apart from `fixtures.ts` so client components never
 * import fixture data.
 */

import type { ComposerOption } from "./contracts";

export const COMPOSER_OPTIONS: ComposerOption[] = [
  { kind: "request", label: "Request or follow-up", detail: "Access request, application or follow-up", icon: "inbox" },
  { kind: "access", label: "Access period or movement", detail: "Arrival, departure or access period", icon: "key-round" },
  { kind: "space_reset", label: "Space reset or upkeep", detail: "Reset, inspection, repair or supplies", icon: "wrench" },
  { kind: "due", label: "Due or expense", detail: "Contribution, expense or invoice", icon: "euro" },
  { kind: "experience", label: "Experience or event", detail: "Dinner, session or programme", icon: "utensils" },
  { kind: "note", label: "Note", detail: "A note against a person, Space or day", icon: "sticky-note" },
];
