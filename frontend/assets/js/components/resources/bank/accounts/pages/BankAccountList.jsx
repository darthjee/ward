import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../../common/ownerContext/hooks/useOwnerContext.js';
import NotFound from '../../../../common/notFound/NotFound.jsx';
import BankAccountsLoader, { buildBankAccountsLoadEffect } from './controllers/BankAccountsLoader.js';
import BankAccountListHelper from './helpers/BankAccountListHelper.jsx';
import { hashQuery } from '../../../../../utils/routing/hashQuery.js';
import { currentHash } from '../../common/currentHash.js';

/**
 * Accounts list page (`<ui>/bank/accounts`): the context's regular accounts, sorted by name,
 * with a *Show archived* toggle (`?archived=true`). A `404` (non-member organization) shows the
 * Not-found view; a network / 5xx failure shows an alert with Retry.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountList() {
  const { context: routeContext } = useOwnerContext();
  // The page is remounted on a context change (see AppHelper), so the first context is kept to
  // avoid reloading on every hash change (each route resolution builds a new context object).
  const [context] = useState(routeContext);
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loader = useMemo(() => new BankAccountsLoader(), []);
  const archived = hashQuery(currentHash()).get('archived') === 'true';

  useEffect(() => buildBankAccountsLoadEffect(loader, context, archived, {
    onLoaded: (loaded) => {
      setAccounts(loaded);
      setError(null);
    },
    onNotFound: () => setNotFound(true),
    onError: setError,
  })(), [loader, context, archived, attempt]);

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  const handlers = {
    onRetry: () => {
      setError(null);
      setAttempt((value) => value + 1);
    },
    onDismiss: () => setError(null),
  };

  return BankAccountListHelper.render({
    accounts, error, archived, context,
  }, handlers);
}
