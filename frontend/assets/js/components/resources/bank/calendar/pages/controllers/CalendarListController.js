import CalendarClient from '../../../../../../client/CalendarClient.js';
import { runLoad } from '../../../common/runLoad.js';
import { localToday } from '../../../common/dates.js';
import { occurrenceKey } from '../../common/occurrenceKey.js';
import { upcomingRange, weekStart } from '../../common/calendarDates.js';

/**
 * Drop from Upcoming the occurrences already listed in Overdue.
 *
 * @description Upcoming starts at the local today while the server computes `overdue` on the
 * UTC today, so an occurrence could come from both requests around the day boundary.
 * @param {Array<object>} upcoming - The `calendar.json` occurrences.
 * @param {Array<object>} overdue - The `overdue.json` occurrences.
 * @returns {Array<object>} The upcoming occurrences not in Overdue, in their order.
 */
export function dedupeUpcoming(upcoming, overdue) {
  const seen = new Set(overdue.map(occurrenceKey));

  return upcoming.filter((occurrence) => !seen.has(occurrenceKey(occurrence)));
}

/**
 * Group occurrences by the Monday of their effective week.
 *
 * @param {Array<object>} occurrences - The occurrences, in date order.
 * @returns {Array<{weekStart: string, occurrences: Array<object>}>} The groups, earliest week
 *   first; each keeps the order of its occurrences.
 */
export function groupByWeek(occurrences) {
  const groups = new Map();

  occurrences.forEach((occurrence) => {
    const start = weekStart(occurrence.effective_date);

    groups.set(start, [...(groups.get(start) ?? []), occurrence]);
  });

  return [...groups.keys()].sort().map((start) => ({ weekStart: start, occurrences: groups.get(start) }));
}

/**
 * Controller of the Calendar **list view**: loads Overdue and Upcoming (today + 59 days).
 */
export default class CalendarListController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {Function} options.setData - Receives `{overdue, upcoming}` (each `{occurrences,
   *   totals}`).
   * @param {Function} options.setError - Receives the classified error (with `retry`).
   * @param {Function} options.setNotFound - Flags an unknown organization.
   * @param {Function} options.reload - Reloads both requests.
   * @param {typeof CalendarClient} [options.client] - HTTP client override.
   */
  constructor({
    context, setData, setError, setNotFound, reload, client = CalendarClient,
  }) {
    this.context = context;
    this.setData = setData;
    this.setError = setError;
    this.setNotFound = setNotFound;
    this.reload = reload;
    this.client = client;
  }

  /**
   * Fetch both lists; resolves `undefined` when either one answers nothing (expired session).
   *
   * @param {string} today - The local today, `YYYY-MM-DD`.
   * @returns {Promise<{overdue: object, upcoming: object}|undefined>} The lists.
   */
  async fetchBoth(today) {
    const { from, to } = upcomingRange(today);
    const [overdue, upcoming] = await Promise.all([
      this.client.getOverdue(this.context),
      this.client.getCalendar(this.context, from, to),
    ]);

    return overdue && upcoming ? { overdue, upcoming } : undefined;
  }

  /**
   * Load Overdue and Upcoming.
   *
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @param {string} [today] - The local today (injectable for specs).
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(isActive = () => true, today = localToday()) {
    await runLoad(() => this.fetchBoth(today), {
      onLoaded: (data) => {
        this.setError(null);
        this.setData(data);
      },
      onNotFound: () => this.setNotFound(true),
      onError: (error) => this.setError({ ...error, retry: this.reload }),
    }, isActive);
  }
}
