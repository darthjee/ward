import DisplayLocale from '../../../../../utils/locale/DisplayLocale.js';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_MONTHS_AHEAD = 12;
const UPCOMING_DAYS = 59;
const WEEK_DAYS = 7;

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
 * Parse an ISO date into a UTC timestamp.
 *
 * @param {string} isoDate - A `YYYY-MM-DD` date.
 * @returns {number} The UTC timestamp at midnight.
 */
function toUtc(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
}

/**
 * Format a UTC timestamp as an ISO date.
 *
 * @param {number} timestamp - The UTC timestamp.
 * @returns {string} The `YYYY-MM-DD` date.
 */
function fromUtc(timestamp) {
  const date = new Date(timestamp);

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Add days to an ISO date (UTC arithmetic).
 *
 * @param {string} isoDate - The `YYYY-MM-DD` date.
 * @param {number} n - Days to add (may be negative).
 * @returns {string} The resulting ISO date.
 */
export function addDays(isoDate, n) {
  return fromUtc(toUtc(isoDate) + n * 86400000);
}

/**
 * Find the Monday (ISO week start) of a date's week.
 *
 * @param {string} isoDate - The `YYYY-MM-DD` date.
 * @returns {string} The Monday's ISO date.
 */
export function weekStart(isoDate) {
  const weekday = new Date(toUtc(isoDate)).getUTCDay();

  return addDays(isoDate, -((weekday + 6) % WEEK_DAYS));
}

/**
 * Build the first and last day of a month.
 *
 * @param {string} m - A `YYYY-MM` month.
 * @returns {{from: string, to: string}} The month's first and last ISO dates.
 */
export function monthRange(m) {
  const [year, month] = m.split('-').map(Number);

  return { from: `${m}-01`, to: fromUtc(Date.UTC(year, month, 0)) };
}

/**
 * Shift a month by a number of months.
 *
 * @param {string} m - A `YYYY-MM` month.
 * @param {number} delta - Months to add (may be negative).
 * @returns {string} The shifted `YYYY-MM` month.
 */
export function shiftMonth(m, delta) {
  const [year, month] = m.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/**
 * Build the latest navigable month (local month + 12).
 *
 * @param {string} today - The local today, `YYYY-MM-DD`.
 * @returns {string} The `YYYY-MM` month.
 */
export function maxMonth(today) {
  return shiftMonth(today.slice(0, 7), MAX_MONTHS_AHEAD);
}

/**
 * Normalise a `m` query value to a valid month.
 *
 * @param {string|null|undefined} m - The raw value.
 * @param {string} today - The local today, `YYYY-MM-DD`.
 * @returns {string} A valid `YYYY-MM`: the current month when missing/invalid, clamped at +12.
 */
export function parseMonth(m, today) {
  const current = today.slice(0, 7);

  if (typeof m !== 'string' || !MONTH_PATTERN.test(m)) {
    return current;
  }

  const max = maxMonth(today);

  return m > max ? max : m;
}

/**
 * Build the weeks of a month grid, Monday to Sunday.
 *
 * @param {string} m - A `YYYY-MM` month.
 * @returns {Array<Array<{date: string, inMonth: boolean}>>} Weeks of 7 days; days of the
 *   adjacent months have `inMonth` false.
 */
export function monthGridWeeks(m) {
  const { from, to } = monthRange(m);
  const weeks = [];
  let start = weekStart(from);

  while (start <= to) {
    weeks.push(Array.from({ length: WEEK_DAYS }, (_, i) => {
      const date = addDays(start, i);

      return { date, inMonth: date.slice(0, 7) === m };
    }));
    start = addDays(start, WEEK_DAYS);
  }

  return weeks;
}

/**
 * Format a date as short weekday and day, in the display locale.
 *
 * @param {string} isoDate - The `YYYY-MM-DD` date.
 * @returns {string} For example `Sat 14`.
 */
export function formatWeekdayDay(isoDate) {
  return new Intl.DateTimeFormat(DisplayLocale.get(), {
    weekday: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(toUtc(isoDate)));
}

/**
 * Build the Upcoming range: today through today + 59 days.
 *
 * @param {string} today - The local today, `YYYY-MM-DD`.
 * @returns {{from: string, to: string}} The range.
 */
export function upcomingRange(today) {
  return { from: today, to: addDays(today, UPCOMING_DAYS) };
}
