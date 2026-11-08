import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountList from '../../common/list/hooks/useAccountList.js';
import BankDebtListHelper from './helpers/BankDebtListHelper.jsx';

/**
 * Debts list page (`<ui>/bank/debts`): the context's debt accounts, sorted by name (as the API
 * returns them), with a *Show archived* toggle (`?archived=true`). A `404` (non-member
 * organization) shows the Not-found view; a network / 5xx failure shows an alert with Retry.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankDebtList() {
  const {
    context, accounts, error, archived, notFound, handlers,
  } = useAccountList('debt');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankDebtListHelper.render({
    accounts, error, archived, context,
  }, handlers);
}
