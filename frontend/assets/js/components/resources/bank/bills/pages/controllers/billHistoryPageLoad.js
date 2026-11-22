import BankClient from '../../../../../../client/BankClient.js';
import ProviderBillsClient from '../../../../../../client/ProviderBillsClient.js';
import { buildLoadEffect, runLoad } from '../../../common/runLoad.js';

/**
 * Load what the bill history page needs: the bill, then its provider (name, currency and
 * `archived_at`).
 *
 * @param {object} context - The owner context.
 * @param {string} billId - The bill id.
 * @param {{bills: typeof ProviderBillsClient, bank: typeof BankClient}} clients - HTTP clients.
 * @returns {Promise<{bill: object, provider: object}>} The loaded data.
 */
async function fetchBillHistoryPage(context, billId, { bills, bank }) {
  const bill = await bills.getProviderBill(context, billId);

  const provider = await bank.getAccount(context, bill.provider_account_id);

  return { bill, provider };
}

/**
 * Build the load effect of the bill history page. Exported so specs can run it without a React
 * renderer.
 *
 * @description Outcomes follow `runLoad`: a `404` from either call (unknown or foreign bill)
 * reports Not-found, other failures the classified error, a session-expired rejection nothing; late
 * answers are dropped. A bill of an archived provider loads normally and renders read-only.
 * @param {object} context - The owner context.
 * @param {string} billId - The bill id.
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
 *   callbacks (`onLoaded` receives `{ bill, provider }`).
 * @param {{bills: typeof ProviderBillsClient, bank: typeof BankClient}} [clients] - HTTP client
 *   overrides.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildBillHistoryPageLoadEffect(
  context,
  billId,
  callbacks,
  clients = { bills: ProviderBillsClient, bank: BankClient },
) {
  return buildLoadEffect((isActive) => runLoad(() => fetchBillHistoryPage(context, billId, clients), callbacks, isActive));
}
