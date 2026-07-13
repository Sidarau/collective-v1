/**
 * CRM labels — free-form tags that stick to people (users + leads) and to
 * referral doors, which stamp their labels onto everyone who enters through
 * them. Comparison is case-insensitive; display keeps the case as typed.
 */

const MAX_LABEL_LENGTH = 40;
const MAX_LABELS = 24;

/** Suggested labels offered in dropdowns alongside whatever is already in use. */
export const LABEL_SUGGESTIONS = [
  "investor",
  "past guest",
  "founding circle",
  "friend of the house",
  "vip",
  "vendor",
  "staff",
  "press",
];

/** Trim, collapse whitespace, cap length. Returns "" for unusable input. */
export function normalizeLabel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_LABEL_LENGTH);
}

/** Case-insensitive union, first-seen casing wins, capped at MAX_LABELS. */
export function mergeLabels(...groups: (readonly unknown[] | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const group of groups) {
    for (const raw of group || []) {
      const label = normalizeLabel(raw);
      if (!label) continue;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
      if (seen.size >= MAX_LABELS) break;
    }
  }
  return [...seen.values()];
}

/** Remove specific labels (case-insensitive) from a list. */
export function removeLabels(existing: readonly unknown[] | null | undefined, remove: readonly unknown[]): string[] {
  const drop = new Set(remove.map((r) => normalizeLabel(r).toLowerCase()).filter(Boolean));
  return mergeLabels(existing).filter((label) => !drop.has(label.toLowerCase()));
}
