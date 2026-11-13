import { useEffect, useState } from 'react';
import BankClient from '../../../../../../client/BankClient.js';
import { buildLoadEffect, runLoad } from '../../runLoad.js';

/**
 * Build the load effect of the paying accounts (the owner's non-archived regular accounts).
 * Exported so specs can run it without a React renderer.
 *
 * @description A failure (or Not-found) leaves the list empty: the Default paying account is
 * optional, so the form still works without it.
 * @param {object} context - The owner context.
 * @param {Function} setAccounts - Receives the loaded accounts (`[]` on failure).
 * @param {typeof BankClient} [client] - HTTP client override, for testability.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildPayingAccountsLoadEffect(context, setAccounts, client = BankClient) {
  return buildLoadEffect((isActive) => runLoad(
    () => client.listAccounts(context, { type: 'regular' }),
    {
      onLoaded: setAccounts,
      onNotFound: () => setAccounts([]),
      onError: () => setAccounts([]),
    },
    isActive,
  ));
}

/**
 * Load the accounts a bill can be paid from: the owner's non-archived regular accounts.
 *
 * @param {object} context - The owner context (kept stable by the page).
 * @returns {Array<object>|null} The accounts, or `null` while loading.
 */
export default function usePayingAccounts(context) {
  const [accounts, setAccounts] = useState(null);

  useEffect(() => buildPayingAccountsLoadEffect(context, setAccounts)(), [context]);

  return accounts;
}
