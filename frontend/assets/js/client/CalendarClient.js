import ApiClient from './ApiClient.js';
import { whitelist } from './accountBodies.js';
import { contextPath } from '../utils/context/ownerContext.js';

/** The only keys a payment body may send. */
export const PAYMENT_FIELDS = ['status', 'paid_on', 'amount', 'paying_account_id', 'record_charge'];

/** The body that skips an occurrence. */
export const SKIP_BODY = Object.freeze({ status: 'skipped' });

const CHARGE_KINDS = ['provider', 'bill'];

/**
 * Build the body that pays an occurrence.
 *
 * @param {{kind: string}} occ - The occurrence.
 * @param {object} fields - The form values (`paid_on`, `amount`, `paying_account_id`,
 *   `record_charge`).
 * @returns {object} The body; `record_charge` is kept only for the `provider` and `bill` kinds.
 */
export function paymentBody(occ, fields) {
  const body = whitelist({ ...fields, status: 'paid' }, PAYMENT_FIELDS);

  if (!CHARGE_KINDS.includes(occ.kind)) {
    delete body.record_charge;
  }

  return body;
}

/**
 * HTTP client for the Calendar (occurrences, overdue) and the Pay / Skip actions, in both owner
 * contexts.
 *
 * @description Every method takes the owner context first and builds its path through
 * `contextPath`. Undo is served by `BillsClient`. Every method may resolve `undefined` when the
 * session turned out to be expired (see {@link ApiClient}).
 */
const CalendarClient = {
  /**
   * Fetch the occurrences and totals of a date range.
   *
   * @param {object} context - The owner context.
   * @param {string} from - The first `YYYY-MM-DD` day.
   * @param {string} to - The last `YYYY-MM-DD` day.
   * @returns {Promise<{occurrences: Array<object>, totals: Array<object>}|undefined>} The data.
   */
  async getCalendar(context, from, to) {
    return ApiClient.getJson(contextPath(context, `/bank/calendar.json?from=${from}&to=${to}`));
  },

  /**
   * Fetch the overdue occurrences (oldest first) and their totals.
   *
   * @param {object} context - The owner context.
   * @returns {Promise<{occurrences: Array<object>, totals: Array<object>}|undefined>} The data.
   */
  async getOverdue(context) {
    return ApiClient.getJson(contextPath(context, '/bank/calendar/overdue.json'));
  },

  /**
   * Pay or skip a derived (debt / provider) occurrence.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The source account id.
   * @param {string} nominalDate - The occurrence's nominal `YYYY-MM-DD` date.
   * @param {object} body - The payment body.
   * @returns {Promise<object|undefined>} The response body.
   */
  async payOccurrence(context, accountId, nominalDate, body) {
    return ApiClient.postJson(
      contextPath(context, `/bank/accounts/${accountId}/occurrences/${nominalDate}/payment.json`),
      whitelist(body, PAYMENT_FIELDS),
    );
  },

  /**
   * Pay a one-off bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The bill id.
   * @param {object} body - The payment body.
   * @returns {Promise<object|undefined>} The response body.
   */
  async payBill(context, billId, body) {
    return ApiClient.postJson(
      contextPath(context, `/bank/bills/${billId}/payment.json`),
      whitelist(body, PAYMENT_FIELDS),
    );
  },
};

export default CalendarClient;
