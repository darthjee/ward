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
