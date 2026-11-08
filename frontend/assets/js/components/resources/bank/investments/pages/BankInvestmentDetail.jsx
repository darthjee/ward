import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountDetail from '../../common/detail/hooks/useAccountDetail.js';
import useUpdateValueForm from '../common/hooks/useUpdateValueForm.js';
import BankInvestmentDetailHelper from './helpers/BankInvestmentDetailHelper.jsx';
import { INVESTMENTS_BASE } from '../../common/sections.js';

/**
 * Investment detail page (`<ui>/bank/investments/:accountId[?page=N]`): the investment header
 * with its actions and info block, the Add application / Add withdrawal / Update value
 * shortcuts and the paginated ledger with its inline form row. A `404` shows the Not-found
 * view.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankInvestmentDetail() {
  const {
    context, notFound, state, handlers, reload, ledgerForm,
  } = useAccountDetail(INVESTMENTS_BASE);
  const updateValue = useUpdateValueForm({
    context, accountId: state.accountId, account: state.data?.account ?? null, reload, ledgerForm,
  });

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankInvestmentDetailHelper.render(
    { ...state, updateValue: updateValue.state },
    { ...handlers, ...updateValue.handlers },
  );
}
