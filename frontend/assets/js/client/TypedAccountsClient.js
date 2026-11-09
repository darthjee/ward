import ApiClient from './ApiClient.js';
import { accountPath, nestedBody } from './accountBodies.js';
import { contextPath } from '../utils/context/ownerContext.js';

const DEBT_FIELDS = [
  'interest_rate', 'interest_period', 'instalment_amount', 'instalment_frequency', 'due_day',
  'due_month', 'instalment_count',
];

const INVESTMENT_FIELDS = ['kind', 'yield_rate', 'yield_period', 'maturity_date', 'liquidity_days'];

const PROVIDER_EXPENSE_FIELDS = [
  'for_accountant', 'provider_tax_id', 'expected_amount', 'charge_frequency', 'due_day',
  'due_month',
];

/**
 * Create a typed account: `type` with the common fields and the optional nested `key` object.
 *
 * @param {object} context - The owner context.
 * @param {string} type - The account type (`debt`, `investment`, `provider_expense`).
 * @param {string} key - The nested object's key.
 * @param {Array<string>} fields - The nested object's allowed keys.
 * @param {object} attrs - The `snake_case` account fields, with an optional nested object.
 * @returns {Promise<object|undefined>} The created account.
 */
function createTyped(context, type, key, fields, attrs) {
  return ApiClient.postJson(
    contextPath(context, '/bank/accounts.json'),
    { type, ...nestedBody(attrs, key, fields) },
  );
}

/**
 * Update a typed account: the common fields and the nested `key` object (merged partially by
 * the backend, `null` clears); `type` is never sent.
 *
 * @param {object} context - The owner context.
 * @param {number|string} id - The account id.
 * @param {string} key - The nested object's key.
 * @param {Array<string>} fields - The nested object's allowed keys.
 * @param {object} attrs - The `snake_case` fields to change, with an optional nested object.
 * @returns {Promise<object|undefined>} The updated account.
 */
function updateTyped(context, id, key, fields, attrs) {
  return ApiClient.patchJson(accountPath(context, id), nestedBody(attrs, key, fields));
}

/**
 * HTTP calls creating and updating the typed accounts (debts, investments, provider expenses),
 * spread into {@link BankClient}.
 *
 * @description Each create posts `type` with the whitelisted common fields and the optional
 * nested object; each update sends a PATCH without `type`, keeping `null` (it clears a field).
 */
const TypedAccountsClient = {
  /**
   * Create a debt account (`type: "debt"`, optional nested `debt`).
   *
   * @param {object} context - The owner context.
   * @param {object} attrs - The `snake_case` account fields, with an optional `debt` object.
   * @returns {Promise<object|undefined>} The created debt account.
   */
  async createDebt(context, attrs) {
    return createTyped(context, 'debt', 'debt', DEBT_FIELDS, attrs);
  },

  /**
   * Update a debt account (partial nested `debt`; `type` never sent).
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @param {object} attrs - The `snake_case` fields to change, with an optional `debt` object.
   * @returns {Promise<object|undefined>} The updated debt account.
   */
  async updateDebt(context, id, attrs) {
    return updateTyped(context, id, 'debt', DEBT_FIELDS, attrs);
  },

  /**
   * Create an investment account (`type: "investment"`, optional nested `investment`; the
   * form sends `opening_balance: "0"`).
   *
   * @param {object} context - The owner context.
   * @param {object} attrs - The `snake_case` account fields, with an optional `investment`.
   * @returns {Promise<object|undefined>} The created investment account.
   */
  async createInvestment(context, attrs) {
    return createTyped(context, 'investment', 'investment', INVESTMENT_FIELDS, attrs);
  },

  /**
   * Update an investment account (partial nested `investment`, `null` clears; `type` never
   * sent).
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @param {object} attrs - The `snake_case` fields to change, with an optional `investment`.
   * @returns {Promise<object|undefined>} The updated investment account.
   */
  async updateInvestment(context, id, attrs) {
    return updateTyped(context, id, 'investment', INVESTMENT_FIELDS, attrs);
  },

  /**
   * Create a provider-expense account (`type: "provider_expense"`, optional nested
   * `provider_expense`).
   *
   * @param {object} context - The owner context.
   * @param {object} attrs - The `snake_case` account fields, with an optional
   *   `provider_expense` object.
   * @returns {Promise<object|undefined>} The created provider-expense account.
   */
  async createProviderExpense(context, attrs) {
    return createTyped(context, 'provider_expense', 'provider_expense', PROVIDER_EXPENSE_FIELDS, attrs);
  },

  /**
   * Update a provider-expense account (partial nested `provider_expense`, `null` clears;
   * `type` never sent).
   *
   * @param {object} context - The owner context.
   * @param {number|string} id - The account id.
   * @param {object} attrs - The `snake_case` fields to change, with an optional
   *   `provider_expense` object.
   * @returns {Promise<object|undefined>} The updated provider-expense account.
   */
  async updateProviderExpense(context, id, attrs) {
    return updateTyped(context, id, 'provider_expense', PROVIDER_EXPENSE_FIELDS, attrs);
  },
};

export default TypedAccountsClient;
