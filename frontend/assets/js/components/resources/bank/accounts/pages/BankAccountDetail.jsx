import { useMemo, useState } from 'react';
import useOwnerContext from '../../../../common/ownerContext/hooks/useOwnerContext.js';
import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountLedger from './hooks/useAccountLedger.js';
import useLedgerForm from './hooks/useLedgerForm.js';
import BankAccountDetailController from './controllers/BankAccountDetailController.js';
import LedgerFormController from './controllers/LedgerFormController.js';
import { buildDetailHandlers } from './controllers/detailHandlers.js';
import BankAccountDetailHelper, { ledgerPageHref } from './helpers/BankAccountDetailHelper.jsx';
import Router from '../../../../../utils/routing/Router.js';
import { currentHash, navigate } from '../../common/currentHash.js';
import { pageFromHash } from '../../common/pageQuery.js';

/**
 * Account detail page (`<ui>/bank/accounts/:accountId[?page=N]`): the account header with its
 * actions and the paginated ledger with its inline form row. The page lives in the hash query,
 * so reload / back / forward keep it. A `404` shows the Not-found view.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountDetail() {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [accountId] = useState(() => Router.extractContextParams('/bank/accounts/:accountId', currentHash()).accountId);
  const page = pageFromHash(currentHash());
  const ledger = useAccountLedger(context, accountId, page);
  const { reload, setNotFound } = ledger;
  const { form, actions } = useLedgerForm();
  const [actionPending, setActionPending] = useState(null);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const detailController = useMemo(() => new BankAccountDetailController({
    context,
    accountId,
    setPending: setActionPending,
    setError,
    setConfirm: setConfirmation,
    reload,
    onNotFound: () => setNotFound(true),
  }), [context, accountId, reload, setNotFound]);
  const ledgerController = useMemo(() => new LedgerFormController({
    context,
    accountId,
    update: actions.update,
    reset: actions.reset,
    setError,
    reload,
    goToFirstPage: () => navigate(ledgerPageHref(context, accountId, 1)),
  }), [context, accountId, actions, reload]);

  if (ledger.notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  const handlers = buildDetailHandlers({
    form,
    actions,
    ledgerController,
    detailController,
    currency: ledger.data?.account.currency,
    page,
    confirmation,
    setConfirmation,
    error,
    setError,
    reload,
  });

  return BankAccountDetailHelper.render({
    context,
    accountId,
    page,
    data: ledger.data,
    loadError: ledger.loadError,
    error,
    form,
    actionPending,
    confirmation,
  }, handlers);
}
