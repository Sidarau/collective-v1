export function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}

export function fmtMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-GB", {
    currency,
    style: "currency",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
