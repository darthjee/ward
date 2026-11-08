import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountDetail from '../../common/detail/hooks/useAccountDetail.js';
import BankAccountDetailHelper from './helpers/BankAccountDetailHelper.jsx';
import { ACCOUNTS_BASE } from '../../common/sections.js';

/**
 * Account detail page (`<ui>/bank/accounts/:accountId[?page=N]`): the account header with its
 * actions and the paginated ledger with its inline form row. The page lives in the hash query,
 * so reload / back / forward keep it. A `404` shows the Not-found view.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountDetail() {
  const {
    context, notFound, state, handlers,
  } = useAccountDetail(ACCOUNTS_BASE);

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankAccountDetailHelper.render(state, handlers);
}
