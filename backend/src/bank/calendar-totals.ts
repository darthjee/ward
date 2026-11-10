import { formatAmount } from './currency.js';
import type { OccurrenceView } from './occurrence-response.js';

/** One per-currency total of `calendar.json`. */
export interface CalendarTotal {
  currency: string;
  expected: string;
  paid: string;
  open: string;
}

/** One per-currency total of `calendar/overdue.json`. */
export interface OverdueTotal {
  currency: string;
  open: string;
}

interface Sums {
  expected: bigint;
  paid: bigint;
  open: bigint;
}

/**
 * Sums the occurrences per currency (never across currencies):
 * - `expected`: the expected amounts (none for an occurrence without one);
 * - `paid`: the actual amounts of `paid` occurrences;
 * - `open`: the expected amounts of `open` / `overdue` occurrences (skipped ones never count).
 * @param {OccurrenceView[]} views - The occurrences.
 * @returns {Map<string, Sums>} The sums keyed by currency, in first-seen order.
 */
function sumByCurrency(views: OccurrenceView[]): Map<string, Sums> {
  const sums = new Map<string, Sums>();

  for (const { response, expected, paid } of views) {
    const sum = sums.get(response.currency) ?? { expected: 0n, paid: 0n, open: 0n };
    const isOpen = response.status === 'open' || response.status === 'overdue';
    sum.expected += expected ?? 0n;
    sum.paid += paid ?? 0n;
    sum.open += isOpen ? expected ?? 0n : 0n;
    sums.set(response.currency, sum);
  }

  return sums;
}

/**
 * @param {OccurrenceView[]} views - The calendar's occurrences.
 * @returns {CalendarTotal[]} One entry per currency present, sorted by currency code; `[]` when empty.
 */
export function calendarTotals(views: OccurrenceView[]): CalendarTotal[] {
  return [...sumByCurrency(views)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, sum]) => ({
      currency,
      expected: formatAmount(sum.expected, currency),
      paid: formatAmount(sum.paid, currency),
      open: formatAmount(sum.open, currency),
    }));
}

/**
 * @param {OccurrenceView[]} views - The overdue occurrences.
 * @returns {OverdueTotal[]} One `{ currency, open }` per currency present, sorted by currency code.
 */
export function overdueTotals(views: OccurrenceView[]): OverdueTotal[] {
  return calendarTotals(views).map(({ currency, open }) => ({ currency, open }));
}
