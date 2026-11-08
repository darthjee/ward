import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import BankAccountLoader, { buildBankAccountLoadEffect } from '../controllers/BankAccountLoader.js';

/**
 * Load an account with one page of its ledger, reloading on demand.
 *
 * @param {object} context - The owner context.
 * @param {number|string} accountId - The account id.
 * @param {number} page - The ledger page (from the hash query).
 * @returns {{data: ({account: object, ledger: object}|null), loadError: (object|null),
 *   notFound: boolean, setNotFound: Function, reload: Function}} The load state; `reload`
 *   re-fetches the account and the current page.
 */
export default function useAccountLedger(context, accountId, page) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loader = useMemo(() => new BankAccountLoader(), []);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => buildBankAccountLoadEffect(loader, context, accountId, page, {
    onLoaded: (loaded) => {
      setData(loaded);
      setLoadError(null);
    },
    onNotFound: () => setNotFound(true),
    onError: setLoadError,
  })(), [loader, context, accountId, page, attempt]);

  return {
    data, loadError, notFound, setNotFound, reload,
  };
}
