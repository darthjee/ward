import BankClient from '../../../../../../client/BankClient.js';
import BillsClient from '../../../../../../client/BillsClient.js';
import { buildLoadEffect, runLoad } from '../../../common/runLoad.js';
import { findProvider, billFieldsFromBill } from './billFormFields.js';

/**
 * Load what a bill page needs: the non-archived providers, the non-archived regular accounts
 * and, on the edit page, the bill.
 *
 * @param {object} context - The owner context.
 * @param {string|null} billId - The bill id (edit page), or `null`.
 * @param {{bank: typeof BankClient, bills: typeof BillsClient}} clients - HTTP clients.
 * @returns {Promise<{providers: Array<object>, accounts: Array<object>, bill: (object|null)}|undefined>}
 *   The loaded data, or `undefined` when the session expired.
 */
async function fetchBillForm(context, billId, { bank, bills }) {
  const [providers, accounts, bill] = await Promise.all([
    bank.listAccounts(context, { type: 'provider_expense' }),
    bank.listAccounts(context, { type: 'regular' }),
    billId ? bills.getBill(context, billId) : Promise.resolve(null),
  ]);

  if (!providers || !accounts || (billId && !bill)) {
    return undefined;
  }

  return { providers, accounts, bill };
}

/**
 * Build the load effect of a bill page. Exported so specs can run it without a React renderer.
 *
 * @description Outcomes follow `runLoad`: a `404` (unknown bill, a bill of an archived provider
 * or a non-member organization) reports Not-found, other failures the classified error, an
 * expired session nothing; late answers are dropped.
 * @param {object} context - The owner context.
 * @param {string|null} billId - The bill id (edit page), or `null`.
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
 *   callbacks (`onLoaded` receives `{ providers, accounts, bill }`).
 * @param {{bank: typeof BankClient, bills: typeof BillsClient}} [clients] - HTTP client
 *   overrides.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildBillFormLoadEffect(context, billId, callbacks, clients = { bank: BankClient, bills: BillsClient }) {
  return buildLoadEffect((isActive) => runLoad(() => fetchBillForm(context, billId, clients), callbacks, isActive));
}

/**
 * Merge the loaded data into the form: the edit page fills its fields from the bill (first
 * load only); the new page drops a pre-selected provider that is not offered.
 *
 * @param {object|null} fields - The current fields.
 * @param {{providers: Array<object>, bill: (object|null)}} loaded - The loaded data.
 * @returns {object|null} The next fields.
 */
export function mergeLoadedBill(fields, { providers, bill }) {
  if (bill) {
    return fields ?? billFieldsFromBill(bill);
  }

  if (!fields || !fields.provider_account_id || findProvider(providers, fields.provider_account_id)) {
    return fields;
  }

  return { ...fields, provider_account_id: '' };
}
