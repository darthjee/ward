import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountDetail from '../../common/detail/hooks/useAccountDetail.js';
import BankDebtDetailHelper from './helpers/BankDebtDetailHelper.jsx';
import { DEBTS_BASE } from '../../common/sections.js';

/**
 * Debt detail page (`<ui>/bank/debts/:accountId[?page=N]`): the debt header with its actions
 * and info block, the Add payment / Add interest shortcuts and the paginated ledger with its
 * inline form row. A `404` shows the Not-found view.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankDebtDetail() {
  const {
    context, notFound, state, handlers,
  } = useAccountDetail(DEBTS_BASE);

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankDebtDetailHelper.render(state, handlers);
}
