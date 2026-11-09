import ApiClient from './ApiClient.js';
import { contextPath } from '../utils/context/ownerContext.js';

/**
 * Normalise the ids of a mark request into the only body key sent.
 *
 * @param {Array<number>} ids - The transaction ids.
 * @returns {{transaction_ids: Array<number>}} The body.
 */
function markBody(ids) {
  return { transaction_ids: Array.from(ids ?? []) };
}

/**
 * HTTP client for the accountant hand-off endpoints (preview and sent marks), in both owner
 * contexts.
 *
 * @description Every method takes the owner context first and builds its path through
 * `contextPath` (`/bank/accountant/...` for Personal, `/orgs/:orgId/bank/accountant/...` for
 * an organization). Every method may resolve `undefined` when the session turned out to be
 * expired (see {@link ApiClient}).
 */
const AccountantClient = {
  /**
   * List the business-expense charges of a date range.
   *
   * @param {object} context - The owner context.
   * @param {{from: string, to: string, includeSent: boolean}} range - The inclusive
   *   `YYYY-MM-DD` range and whether charges already sent are included.
   * @returns {Promise<{charges: Array<object>}|undefined>} The charges, each with its
   *   `account` (`id`, `name`, `bank_name`, `provider_tax_id`, `currency`).
   */
  async listCharges(context, { from, to, includeSent = false }) {
    const query = new URLSearchParams({ from, to, include_sent: String(Boolean(includeSent)) });

    return ApiClient.getJson(contextPath(context, `/bank/accountant/charges.json?${query}`));
  },

  /**
   * Mark charges as sent to the accountant.
   *
   * @param {object} context - The owner context.
   * @param {Array<number>} ids - The transaction ids.
   * @returns {Promise<{charges: Array<object>}|undefined>} The charges with their
   *   `sent_to_accountant_at`.
   */
  async markSent(context, ids) {
    return ApiClient.postJson(contextPath(context, '/bank/accountant/mark-sent.json'), markBody(ids));
  },

  /**
   * Clear the sent mark of charges (the undo of {@link AccountantClient.markSent}).
   *
   * @param {object} context - The owner context.
   * @param {Array<number>} ids - The transaction ids.
   * @returns {Promise<{charges: Array<object>}|undefined>} The charges with
   *   `sent_to_accountant_at: null`.
   */
  async markUnsent(context, ids) {
    return ApiClient.postJson(contextPath(context, '/bank/accountant/mark-unsent.json'), markBody(ids));
  },
};

export default AccountantClient;
