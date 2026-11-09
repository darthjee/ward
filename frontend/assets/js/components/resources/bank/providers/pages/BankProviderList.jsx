import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountList from '../../common/list/hooks/useAccountList.js';
import BankProviderListHelper from './helpers/BankProviderListHelper.jsx';

/**
 * Providers list page (`<ui>/bank/providers`): the context's provider-expense accounts, sorted
 * by name (as the API returns them), with a *Show archived* toggle (`?archived=true`) and the
 * **Accountant hand-off** link. A `404` (non-member organization) shows the Not-found view; a
 * network / 5xx failure shows an alert with Retry.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankProviderList() {
  const {
    context, accounts, error, archived, notFound, handlers,
  } = useAccountList('provider_expense');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankProviderListHelper.render({
    accounts, error, archived, context,
  }, handlers);
}
