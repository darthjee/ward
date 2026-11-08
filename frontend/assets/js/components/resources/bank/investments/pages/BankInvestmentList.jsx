import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountList from '../../common/list/hooks/useAccountList.js';
import BankInvestmentListHelper from './helpers/BankInvestmentListHelper.jsx';

/**
 * Investments list page (`<ui>/bank/investments`): the context's investment accounts, sorted by
 * name (as the API returns them), with a *Show archived* toggle (`?archived=true`). A `404`
 * (non-member organization) shows the Not-found view; a network / 5xx failure shows an alert
 * with Retry.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankInvestmentList() {
  const {
    context, accounts, error, archived, notFound, handlers,
  } = useAccountList('investment');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankInvestmentListHelper.render({
    accounts, error, archived, context,
  }, handlers);
}
