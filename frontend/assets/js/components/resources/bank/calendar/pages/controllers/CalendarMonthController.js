import CalendarClient from '../../../../../../client/CalendarClient.js';
import { runLoad } from '../../../common/runLoad.js';
import { monthRange } from '../../common/calendarDates.js';

/**
 * Group occurrences by effective date.
 *
 * @param {Array<object>} occurrences - The occurrences.
 * @returns {Map<string, Array<object>>} The occurrences per `effective_date`, in server order.
 */
export function entriesByDay(occurrences) {
  const byDay = new Map();

  occurrences.forEach((occurrence) => {
    byDay.set(occurrence.effective_date, [...(byDay.get(occurrence.effective_date) ?? []), occurrence]);
  });

  return byDay;
}

/**
 * Controller of the Calendar **month view**: loads one month with a single request.
 */
export default class CalendarMonthController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {Function} options.setData - Receives `{month, occurrences, totals}`.
   * @param {Function} options.setError - Receives the classified error (with `retry`).
   * @param {Function} options.setNotFound - Flags an unknown organization.
   * @param {Function} options.reload - Reloads the month.
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
   * Load one month.
   *
   * @param {string} month - The `YYYY-MM` month.
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(month, isActive = () => true) {
    const { from, to } = monthRange(month);

    await runLoad(() => this.client.getCalendar(this.context, from, to), {
      onLoaded: (data) => {
        this.setError(null);
        this.setData({ ...data, month });
      },
      onNotFound: () => this.setNotFound(true),
      onError: (error) => this.setError({ ...error, retry: this.reload }),
    }, isActive);
  }
}
