import DisplayLocale from '../../../../utils/locale/DisplayLocale.js';

/**
 * Pad a date part to two digits.
 *
 * @param {number} value - The part.
 * @returns {string} The padded part.
 */
function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * Build the browser's local today as `YYYY-MM-DD` (not UTC).
 *
 * @param {Date} [now] - The current instant (injectable for specs).
 * @returns {string} The local date.
 */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Check whether a `YYYY-MM-DD` date is after the browser's local today.
 *
 * @param {string} date - The date.
 * @param {Date} [now] - The current instant (injectable for specs).
 * @returns {boolean} True when the date is later than local today.
 */
export function isAfterLocalToday(date, now = new Date()) {
  return String(date) > localToday(now);
}

/**
 * Name a month (1–12) in the display locale.
 *
 * @param {number|null} month - The 1-based month.
 * @returns {string} The month name, or `''` when unset.
 */
export function monthName(month) {
  if (!month) {
    return '';
  }

  return new Intl.DateTimeFormat(DisplayLocale.get(), { month: 'long' }).format(new Date(2000, month - 1, 1));
}

/**
 * Build the last full calendar month before the browser's local today.
 *
 * @param {Date} [now] - The current instant (injectable for specs).
 * @returns {{from: string, to: string}} The month's first and last local days, `YYYY-MM-DD`
 *   (e.g. `2026-03-15` → `2026-02-01`..`2026-02-28`; January → the previous December).
 */
export function lastFullMonth(now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);

  return { from: localToday(first), to: localToday(last) };
}
