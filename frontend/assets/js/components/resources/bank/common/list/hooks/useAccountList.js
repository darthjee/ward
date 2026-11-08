import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import BankAccountsLoader, { buildBankAccountsLoadEffect } from '../controllers/BankAccountsLoader.js';
import { hashQuery } from '../../../../../../utils/routing/hashQuery.js';
import { currentHash } from '../../currentHash.js';

/**
 * State of an accounts list page (Accounts, Debts or Investments): the accounts of one type, with the
 * *Show archived* filter read from the hash query (`?archived=true`).
 *
 * @description The page is remounted on a context change (see AppHelper), so the first context
 * is kept to avoid reloading on every hash change (each route resolution builds a new context
 * object).
 * @param {string} type - The account type listed (`'regular'`, `'debt'` or `'investment'`).
 * @returns {{context: object, accounts: (Array<object>|null), error: (object|null),
 *   archived: boolean, notFound: boolean, handlers: {onRetry: Function, onDismiss: Function}}}
 *   The list state and its alert handlers.
 */
export default function useAccountList(type) {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loader = useMemo(() => new BankAccountsLoader(undefined, { type }), [type]);
  const archived = hashQuery(currentHash()).get('archived') === 'true';

  useEffect(() => buildBankAccountsLoadEffect(loader, context, archived, {
    onLoaded: (loaded) => {
      setAccounts(loaded);
      setError(null);
    },
    onNotFound: () => setNotFound(true),
    onError: setError,
  })(), [loader, context, archived, attempt]);

  const handlers = {
    onRetry: () => {
      setError(null);
      setAttempt((value) => value + 1);
    },
    onDismiss: () => setError(null),
  };

  return {
    context, accounts, error, archived, notFound, handlers,
  };
}
