import ApiClient from './ApiClient.js';
import { accountPath, whitelist } from './accountBodies.js';

/** The only keys a statement start / edit may send (the account and status are never sent). */
export const STATEMENT_FIELDS = ['statement_date', 'statement_balance'];

/** The only keys a ticks update may send. */
export const TICK_FIELDS = ['tick', 'untick'];

/**
 * Build the context-aware path of an account's reconciliations.
 *
 * @param {object} context - The owner context.
 * @param {number|string} accountId - The account id.
 * @param {number|string} [id] - The reconciliation id, when addressing one statement.
 * @param {string} [suffix] - A path suffix after the id, e.g. `/finish`.
 * @returns {string} The API path, with the `.json` suffix.
 */
function reconciliationPath(context, accountId, id = undefined, suffix = '') {
  const idPart = id === undefined ? '' : `/${id}`;

  return accountPath(context, accountId, `/reconciliations${idPart}${suffix}`);
}

/**
 * HTTP calls for an account's reconciliations (statements), spread into {@link BankClient}.
 *
 * @description Every method takes the owner context first. Start, edit and ticks bodies are
 * whitelisted to {@link STATEMENT_FIELDS} / {@link TICK_FIELDS}. Every method may resolve
 * `undefined` when the session turned out to be expired (see {@link ApiClient}).
 */
const ReconciliationsClient = {
  /**
   * List one page of an account's statements (newest first).
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number} [page] - The 1-based page.
   * @returns {Promise<object|undefined>} The statements envelope.
   */
  async listReconciliations(context, accountId, page = 1) {
    return ApiClient.getJson(`${reconciliationPath(context, accountId)}?page=${page}`);
  },

  /**
   * Start a statement.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {object} attrs - `statement_date` and `statement_balance`.
   * @returns {Promise<object|undefined>} The created statement.
   */
  async startReconciliation(context, accountId, attrs) {
    return ApiClient.postJson(
      reconciliationPath(context, accountId),
      whitelist(attrs, STATEMENT_FIELDS),
    );
  },

  /**
   * Fetch one statement.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The statement id.
   * @returns {Promise<object|undefined>} The statement.
   */
  async getReconciliation(context, accountId, id) {
    return ApiClient.getJson(reconciliationPath(context, accountId, id));
  },

  /**
   * Edit an open statement.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The statement id.
   * @param {object} attrs - `statement_date` and / or `statement_balance`.
   * @returns {Promise<object|undefined>} The updated statement.
   */
  async updateReconciliation(context, accountId, id, attrs) {
    return ApiClient.patchJson(
      reconciliationPath(context, accountId, id),
      whitelist(attrs, STATEMENT_FIELDS),
    );
  },

  /**
   * Cancel (delete) an open statement.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The statement id.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async cancelReconciliation(context, accountId, id) {
    return ApiClient.deleteJson(reconciliationPath(context, accountId, id));
  },

  /**
   * Tick and / or untick transactions on an open statement.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The statement id.
   * @param {{tick: Array<number>, untick: Array<number>}} attrs - The transaction ids.
   * @returns {Promise<object|undefined>} The updated statement.
   */
  async tickTransactions(context, accountId, id, attrs) {
    return ApiClient.patchJson(
      reconciliationPath(context, accountId, id, '/ticks'),
      whitelist(attrs, TICK_FIELDS),
    );
  },

  /**
   * Finish a statement.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The statement id.
   * @returns {Promise<object|undefined>} The finished statement.
   */
  async finishReconciliation(context, accountId, id) {
    return ApiClient.postJson(reconciliationPath(context, accountId, id, '/finish'), {});
  },

  /**
   * Undo the latest finished statement.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The statement id.
   * @returns {Promise<object|undefined>} The undone statement.
   */
  async undoReconciliation(context, accountId, id) {
    return ApiClient.postJson(reconciliationPath(context, accountId, id, '/undo'), {});
  },
};

export default ReconciliationsClient;
