import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountDetail from '../../common/detail/hooks/useAccountDetail.js';
import useMarkUnsent from '../common/hooks/useMarkUnsent.js';
import BankProviderDetailHelper from './helpers/BankProviderDetailHelper.jsx';
import { PROVIDERS_BASE } from '../../common/sections.js';

/**
 * Provider detail page (`<ui>/bank/providers/:accountId[?page=N]`): the provider header with
 * its actions and info block, the Add charge / Add payment shortcuts, and the paginated ledger
 * with its inline form row, each sent charge showing its sent date and **Mark as unsent**.
 * Editing or deleting a sent charge asks first. A `404` shows the Not-found view.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankProviderDetail() {
  const {
    context, notFound, state, handlers, reload, setError,
  } = useAccountDetail(PROVIDERS_BASE);
  const markUnsent = useMarkUnsent({ context, reload, setError });

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankProviderDetailHelper.render(
    { ...state, ...markUnsent.state },
    { ...handlers, ...markUnsent.handlers },
  );
}
