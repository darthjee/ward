import NotFound from '../../../../common/notFound/NotFound.jsx';
import useBillHistoryPage from './hooks/useBillHistoryPage.js';
import BankBillHistoryHelper from './helpers/BankBillHistoryHelper.jsx';

/**
 * Bill history page (`<ui>/bank/bills/:billId/history`): the paid and skipped payments of one
 * provider bill, newest first, with Undo (hidden while the provider is archived). Only an
 * unknown (or foreign) bill shows Not-found; a bill of an archived provider renders read-only
 * (payments listed, Undo hidden by `BillHistoryHelper`).
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
