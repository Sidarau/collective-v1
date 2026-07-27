/**
 * Money formatting. Amounts are always minor units in the contracts, and
 * direction is announced as a word — never as a bare sign or arrow alone.
 */

import type { MoneyDirection } from "@/data/contracts";

export function formatMoney(minor: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

/** Compact form for the day summary line, e.g. "€2.4k". */
export function formatMoneyCompact(minor: number, currency = "EUR"): string {
  const units = minor / 100;
  if (Math.abs(units) >= 1000) {
    const k = units / 1000;
    const rounded = Math.round(k * 10) / 10;
    const symbol = currency === "EUR" ? "€" : `${currency} `;
    return `${symbol}${rounded}k`;
  }
  return formatMoney(minor, currency);
}

export function directionLabel(direction: MoneyDirection): string {
  return direction === "incoming" ? "Incoming" : "Outgoing";
}

/**
 * Screen-reader text for an amount. Says the direction in words so the meaning
 * never depends on a glyph.
 */
export function moneyAnnouncement(
  minor: number,
  currency: string,
  direction?: MoneyDirection,
): string {
  const amount = formatMoney(minor, currency);
  if (!direction) return amount;
  return `${amount} ${direction === "incoming" ? "incoming" : "outgoing"}`;
}
