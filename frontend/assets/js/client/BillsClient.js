import ApiClient from './ApiClient.js';
import { whitelist } from './accountBodies.js';
import { contextPath } from '../utils/context/ownerContext.js';

/** The only keys a bill create / update may send (owner fields are never sent). */
export const BILL_FIELDS = [
  'provider_account_id', 'paying_account_id', 'due_date', 'amount', 'description', 'notes',
];

/**
 * Build the context-aware path of a bill.
 *
 * @param {object} context - The owner context.
 * @param {number|string} id - The bill id.
 * @param {string} [suffix] - A path suffix, e.g. `/payment`.
 * @returns {string} The API path, with the `.json` suffix.
 */
function billPath(context, id, suffix = '') {
  return contextPath(context, `/bank/bills/${id}${suffix}.json`);
}

/**
 * HTTP client for the one-off bills, the bill history and the undo of bill payments, in both
 * owner contexts.
 *
 * @description Every method takes the owner context first and builds its path through
 * `contextPath` (`/bank/...` for Personal, `/orgs/:orgId/bank/...` for an organization). Bodies
 * are whitelisted to {@link BILL_FIELDS}. Every method may resolve `undefined` when the session
 * turned out to be expired (see {@link ApiClient}).
 */
const BillsClient = {
  /**
   * Fetch one one-off bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The bill id.
   * @returns {Promise<object|undefined>} The bill.
   */
  async getBill(context, id) {
    return ApiClient.getJson(billPath(context, id));
  },

  /**
   * Create a one-off bill.
   *
   * @param {object} context - The owner context.
   * @param {object} attrs - The `snake_case` bill fields.
   * @returns {Promise<object|undefined>} The created bill.
   */
  async createBill(context, attrs) {
    return ApiClient.postJson(contextPath(context, '/bank/bills.json'), whitelist(attrs, BILL_FIELDS));
  },

  /**
   * Update a one-off bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The bill id.
   * @param {object} attrs - The `snake_case` fields to change (`notes: null` clears the notes).
   * @returns {Promise<object|undefined>} The updated bill.
   */
  async updateBill(context, id, attrs) {
    return ApiClient.patchJson(billPath(context, id), whitelist(attrs, BILL_FIELDS));
  },

  /**
   * Delete an unpaid one-off bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The bill id.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async deleteBill(context, id) {
    return ApiClient.deleteJson(billPath(context, id));
  },

  /**
   * Fetch one page of an account's bill history (newest due date first).
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The debt / provider-expense account id.
   * @param {number} [page] - The 1-based page.
   * @returns {Promise<{payments: Array<object>, pagination: object}|undefined>} The history.
   */
  async listBillPayments(context, accountId, page = 1) {
    return ApiClient.getJson(
      contextPath(context, `/bank/accounts/${accountId}/bill-payments.json?page=${page}`),
    );
  },

  /**
   * Undo the payment (or skip) of a derived occurrence.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {string} dueDate - The occurrence's `YYYY-MM-DD` due date.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async undoOccurrencePayment(context, accountId, dueDate) {
    return ApiClient.deleteJson(
      contextPath(context, `/bank/accounts/${accountId}/occurrences/${dueDate}/payment.json`),
    );
  },

  /**
   * Undo the payment of a one-off bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The bill id.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async undoBillPayment(context, billId) {
    return ApiClient.deleteJson(billPath(context, billId, '/payment'));
  },
};

export default BillsClient;
