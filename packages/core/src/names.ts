/**
 * Names are entered inconsistently ("alex", "ALEX", "mary-jane o'brien").
 * We always present them Init-Capped — "Alex", "Mary-Jane O'Brien" — in every
 * member-facing surface and email. This normalises for display only; the raw
 * value stays in the database.
 */
export function titleCaseName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cap = (word: string) =>
    // Recurse across hyphens and apostrophes so "mary-jane" and "o'brien" both work.
    word
      .split(/([-'’])/)
      .map((part) =>
        /[-'’]/.test(part) || !part
          ? part
          : part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase()
      )
      .join("");
  return raw.trim().replace(/\s+/g, " ").split(" ").map(cap).join(" ");
}

/** Convenience: Init-Capped "First Last" from parts, skipping blanks. */
export function fullName(
  first: string | null | undefined,
  last?: string | null | undefined
): string {
  return [titleCaseName(first), titleCaseName(last)].filter(Boolean).join(" ");
}
