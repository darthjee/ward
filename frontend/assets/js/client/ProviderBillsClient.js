import ApiClient from './ApiClient.js';
import { PAYMENT_FIELDS } from './CalendarClient.js';
import { whitelist } from './accountBodies.js';
import { contextPath } from '../utils/context/ownerContext.js';

/** The only keys a provider-bill create / update may send (owner fields are never sent). */
export const PROVIDER_BILL_FIELDS = [
  'kind', 'description', 'expected_amount', 'paying_account_id', 'notes', 'charge_frequency',
  'due_day', 'due_month', 'bills_from', 'show_in_calendar', 'due_date', 'provider_account_id',
];

/**
 * Build the context-aware path of a provider bill.
 *
 * @param {object} context - The owner context.
 * @param {number|string} id - The provider bill id.
 * @returns {string} The API path, with the `.json` suffix.
 */
function billPath(context, id) {
  return contextPath(context, `/bank/provider-bills/${id}.json`);
}

/**
 * Build the context-aware path of a provider bill's occurrence payment.
 *
 * @param {object} context - The owner context.
 * @param {number|string} billId - The provider bill id.
 * @param {string} dueDate - The occurrence's `YYYY-MM-DD` due date.
 * @returns {string} The API path, with the `.json` suffix.
 */
function occurrencePaymentPath(context, billId, dueDate) {
  return contextPath(context, `/bank/provider-bills/${billId}/occurrences/${dueDate}/payment.json`);
}

/**
 * HTTP client for the provider-bills CRUD, payment and history routes, in both owner contexts.
 *
 * @description Every method takes the owner context first and builds its path through
 * `contextPath`. Bodies are whitelisted to {@link PROVIDER_BILL_FIELDS}; the update never sends
 * `kind`. Every method may resolve `undefined` when the session turned out to be expired.
 */
const ProviderBillsClient = {
  /**
   * Fetch one page of a provider's bills.
   *
   * @param {object} context - The owner context.
   * @param {number|string} providerId - The provider account id.
   * @param {number} [page] - The 1-based page.
   * @returns {Promise<{provider_bills: Array<object>, pagination: object}|undefined>} The page.
   */
  async listProviderBills(context, providerId, page = 1) {
    return ApiClient.getJson(
      contextPath(context, `/bank/accounts/${providerId}/provider-bills.json?page=${page}`),
    );
  },

  /**
   * Fetch one provider bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The provider bill id.
   * @returns {Promise<object|undefined>} The bill.
   */
  async getProviderBill(context, billId) {
    return ApiClient.getJson(billPath(context, billId));
  },

  /**
   * Create a provider bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} providerId - The provider account id.
   * @param {object} attrs - The `snake_case` bill fields.
   * @returns {Promise<object|undefined>} The created bill.
   */
  async createProviderBill(context, providerId, attrs) {
    return ApiClient.postJson(
      contextPath(context, `/bank/accounts/${providerId}/provider-bills.json`),
      whitelist(attrs, PROVIDER_BILL_FIELDS),
    );
  },

  /**
   * Update a provider bill (the `kind` is never sent).
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The provider bill id.
   * @param {object} attrs - The `snake_case` fields to change.
   * @returns {Promise<object|undefined>} The updated bill.
   */
  async updateProviderBill(context, billId, attrs) {
    const body = whitelist(attrs, PROVIDER_BILL_FIELDS.filter((field) => field !== 'kind'));

    return ApiClient.patchJson(billPath(context, billId), body);
  },

  /**
   * Delete a provider bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The provider bill id.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async deleteProviderBill(context, billId) {
    return ApiClient.deleteJson(billPath(context, billId));
  },

  /**
   * Fetch one page of a bill's payment history (newest due date first).
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The provider bill id.
   * @param {number} [page] - The 1-based page.
   * @returns {Promise<{payments: Array<object>, pagination: object}|undefined>} The history.
   */
  async listBillPayments(context, billId, page = 1) {
    return ApiClient.getJson(
      contextPath(context, `/bank/provider-bills/${billId}/bill-payments.json?page=${page}`),
    );
  },

  /**
   * Pay or skip an occurrence of a bill. Build the body with `paymentBody` / `SKIP_BODY` of
   * `CalendarClient`.
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The provider bill id.
   * @param {string} dueDate - The occurrence's `YYYY-MM-DD` due date.
   * @param {object} body - The payment body.
   * @returns {Promise<object|undefined>} The response body.
   */
  async payOccurrence(context, billId, dueDate, body) {
    return ApiClient.postJson(
      occurrencePaymentPath(context, billId, dueDate),
      whitelist(body, PAYMENT_FIELDS),
    );
  },

  /**
   * Undo the payment (or skip) of an occurrence of a bill.
   *
   * @param {object} context - The owner context.
   * @param {number|string} billId - The provider bill id.
   * @param {string} dueDate - The occurrence's `YYYY-MM-DD` due date.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async undoOccurrencePayment(context, billId, dueDate) {
    return ApiClient.deleteJson(occurrencePaymentPath(context, billId, dueDate));
  },
};

export default ProviderBillsClient;
