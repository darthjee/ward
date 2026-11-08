import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountList from '../../common/list/hooks/useAccountList.js';
import BankAccountListHelper from './helpers/BankAccountListHelper.jsx';

/**
 * Accounts list page (`<ui>/bank/accounts`): the context's regular accounts, sorted by name,
 * with a *Show archived* toggle (`?archived=true`). A `404` (non-member organization) shows the
 * Not-found view; a network / 5xx failure shows an alert with Retry.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountList() {
  const {
    context, accounts, error, archived, notFound, handlers,
  } = useAccountList('regular');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankAccountListHelper.render({
    accounts, error, archived, context,
  }, handlers);
}
