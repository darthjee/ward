import pickDefined from './pickDefined.js';
import { contextPath } from '../utils/context/ownerContext.js';

/** The common account fields every account create / update may send. */
export const ACCOUNT_FIELDS = [
  'name', 'bank_name', 'branch', 'account_number', 'currency', 'opening_date', 'opening_balance',
  'notes',
];

/**
 * Build a request body from a whitelist of keys.
 *
 * @description Only whitelisted, defined keys are kept, so owner fields (`user_id`,
 * `organization_id`) and unknown keys are never sent; `null` is kept (it clears a field).
 * @param {object} attrs - The caller's attributes.
 * @param {Array<string>} fields - The allowed `snake_case` keys.
 * @returns {object} The body.
 */
export function whitelist(attrs, fields) {
  const source = new Map(Object.entries(attrs ?? {}));

  return pickDefined(Object.fromEntries(fields.map((field) => [field, source.get(field)])));
}

/**
 * Build a typed account body (debt, investment, provider expense): the whitelisted common fields plus, when
 * given, the nested `key` object whitelisted to `fields` (`null` kept to clear, `undefined`
 * dropped).
 *
 * @param {object} attrs - The caller's attributes (common fields and an optional `key` object).
 * @param {string} key - The nested object's key (`debt`, `investment`, `provider_expense`).
 * @param {Array<string>} fields - The nested object's allowed keys.
 * @returns {object} The body, never carrying `type`.
 */
export function nestedBody(attrs, key, fields) {
  const body = whitelist(attrs, ACCOUNT_FIELDS);
  const nested = new Map(Object.entries(attrs ?? {})).get(key);

  return nested === undefined || nested === null ? body : { ...body, [key]: whitelist(nested, fields) };
}

/**
 * Build the context-aware path of an account.
 *
 * @param {object} context - The owner context.
 * @param {number|string} id - The account id.
 * @param {string} [suffix] - A path suffix, e.g. `/archive`.
 * @returns {string} The API path, with the `.json` suffix.
 */
export function accountPath(context, id, suffix = '') {
  return contextPath(context, `/bank/accounts/${id}${suffix}.json`);
}
