// Pure helpers for the `DATE` values of the ledger (`opening_date`, a
// transaction's `date`). The server runs in UTC; a date is accepted up to UTC
// today + 1 day, which covers every timezone with no configuration.

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Date} now - The current instant.
 * @returns {string} The UTC calendar date of `now`, as `YYYY-MM-DD`.
 */
export function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * @param {unknown} value - A candidate date.
 * @returns {boolean} `true` when `value` is a `YYYY-MM-DD` string naming a
 *   real calendar day (e.g. not `2026-02-30`).
 */
export function isIsoDate(value: unknown): value is string {
  const match = typeof value === 'string' ? ISO_DATE_PATTERN.exec(value) : null;

  if (!match) {
    return false;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  return date.getUTCFullYear() >= 1000 && todayUtc(date) === value;
}

/**
 * @param {unknown} value - A candidate ledger date.
 * @param {Date} now - The current instant.
 * @returns {boolean} `true` when `value` is a valid `YYYY-MM-DD` date not after
 *   UTC today + 1 day.
 */
export function isAllowedLedgerDate(value: unknown, now: Date): value is string {
  return isIsoDate(value) && value <= todayUtc(new Date(now.getTime() + DAY_MS));
}
