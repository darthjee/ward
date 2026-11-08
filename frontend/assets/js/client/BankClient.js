import ApiClient from './ApiClient.js';
import pickDefined from './pickDefined.js';
import { contextPath } from '../utils/context/ownerContext.js';

const ACCOUNT_FIELDS = [
  'name', 'bank_name', 'branch', 'account_number', 'currency', 'opening_date', 'opening_balance',
  'notes',
];

const TRANSACTION_FIELDS = ['date', 'amount', 'description', 'notes'];

/**
 * Build a request body from a whitelist of keys.
 *
 * @description Only whitelisted, defined keys are kept, so owner fields (`user_id`,
 * `organization_id`) and unknown keys are never sent; `null` is kept (it clears a field).
 * @param {object} attrs - The caller's attributes.
 * @param {Array<string>} fields - The allowed `snake_case` keys.
 * @returns {object} The body.
 */
function whitelist(attrs, fields) {
  const source = new Map(Object.entries(attrs ?? {}));

  return pickDefined(Object.fromEntries(fields.map((field) => [field, source.get(field)])));
}

/**
 * Build the context-aware path of an account.
 *
 * @param {object} context - The owner context.
 * @param {number|string} id - The account id.
 * @param {string} [suffix] - A path suffix, e.g. `/archive`.
 * @returns {string} The API path, with the `.json` suffix.
 */
function accountPath(context, id, suffix = '') {
  return contextPath(context, `/bank/accounts/${id}${suffix}.json`);
}

/**
 * HTTP client for the bank endpoints (accounts, transactions and settings), in both owner
 * contexts.
 *
 * @description Every method takes the owner context first and builds its path through
 * `contextPath` (`/bank/...` for Personal, `/orgs/:orgId/bank/...` for an organization). Every
 * method may resolve `undefined` when the session turned out to be expired (see
 * {@link ApiClient}).
 */
const BankClient = {
  /**
   * List the regular accounts.
   *
   * @param {object} context - The owner context.
   * @param {{archived: boolean}} [options] - `archived: true` includes archived accounts.
   * @returns {Promise<Array<object>|undefined>} The accounts, sorted by name.
   */
  async listAccounts(context, { archived = false } = {}) {
    return ApiClient.getJson(
      contextPath(context, `/bank/accounts.json?type=regular&archived=${Boolean(archived)}`),
    );
  },

  /**
   * Fetch one account, with its full account number and balance.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @returns {Promise<object|undefined>} The account.
   */
  async getAccount(context, id) {
    return ApiClient.getJson(accountPath(context, id));
  },

  /**
   * Create a regular account.
   *
   * @param {object} context - The owner context.
   * @param {object} attrs - The `snake_case` account fields.
   * @returns {Promise<object|undefined>} The created account (masked account number).
   */
  async createAccount(context, attrs) {
    return ApiClient.postJson(
      contextPath(context, '/bank/accounts.json'),
      whitelist(attrs, ACCOUNT_FIELDS),
    );
  },

  /**
   * Update an account.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @param {object} attrs - The `snake_case` fields to change.
   * @returns {Promise<object|undefined>} The updated account (masked account number).
   */
  async updateAccount(context, id, attrs) {
    return ApiClient.patchJson(accountPath(context, id), whitelist(attrs, ACCOUNT_FIELDS));
  },

  /**
   * Hard-delete an account without transactions.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async deleteAccount(context, id) {
    return ApiClient.deleteJson(accountPath(context, id));
  },

  /**
   * Archive an account.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @returns {Promise<object|undefined>} The archived account (masked account number).
   */
  async archiveAccount(context, id) {
    return ApiClient.postJson(accountPath(context, id, '/archive'), {});
  },

  /**
   * Unarchive an account.
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @returns {Promise<object|undefined>} The unarchived account (masked account number).
   */
  async unarchiveAccount(context, id) {
    return ApiClient.postJson(accountPath(context, id, '/unarchive'), {});
  },

  /**
   * Fetch one page of an account's ledger.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number} [page] - The 1-based page.
   * @returns {Promise<object|undefined>} The ledger envelope
   *   (`{ transactions, opening, pagination }`).
   */
  async listTransactions(context, accountId, page = 1) {
    return ApiClient.getJson(
      contextPath(context, `/bank/accounts/${accountId}/transactions.json?page=${page}`),
    );
  },

  /**
   * Create a transaction.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {object} attrs - `date`, `amount` (signed decimal string), `description`, `notes`.
   * @returns {Promise<object|undefined>} The created transaction.
   */
  async createTransaction(context, accountId, attrs) {
    return ApiClient.postJson(
      contextPath(context, `/bank/accounts/${accountId}/transactions.json`),
      whitelist(attrs, TRANSACTION_FIELDS),
    );
  },

  /**
   * Update a transaction.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The transaction id.
   * @param {object} attrs - The fields to change (`notes: null` clears the notes).
   * @returns {Promise<object|undefined>} The updated transaction.
   */
  async updateTransaction(context, accountId, id, attrs) {
    return ApiClient.patchJson(
      contextPath(context, `/bank/accounts/${accountId}/transactions/${id}.json`),
      whitelist(attrs, TRANSACTION_FIELDS),
    );
  },

  /**
   * Delete a transaction.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number|string} id - The transaction id.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  async deleteTransaction(context, accountId, id) {
    return ApiClient.deleteJson(
      contextPath(context, `/bank/accounts/${accountId}/transactions/${id}.json`),
    );
  },

  /**
   * Fetch the bank settings (the default currency).
   *
   * @param {object} context - The owner context.
   * @returns {Promise<{default_currency: string}|undefined>} The settings.
   */
  async getSettings(context) {
    return ApiClient.getJson(contextPath(context, '/bank/settings.json'));
  },
};

export default BankClient;
