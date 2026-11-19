import NotFound from '../../../../common/notFound/NotFound.jsx';
import useBillHistoryPage from './hooks/useBillHistoryPage.js';
import BankBillHistoryHelper from './helpers/BankBillHistoryHelper.jsx';

/**
 * Bill history page (`<ui>/bank/bills/:billId/history`): the paid and skipped payments of one
 * provider bill, newest first, with Undo (hidden while the provider is archived). An unknown
 * bill, or one of an archived provider, shows Not-found.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankBillHistory() {
  const {
    context, notFound, state, onRetryLoad,
  } = useBillHistoryPage();

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankBillHistoryHelper.render({ ...state, context }, { onRetryLoad });
}
