import { useMemo, useState } from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import useAccountLedger from './useAccountLedger.js';
import useLedgerForm from './useLedgerForm.js';
import BankAccountDetailController from '../controllers/BankAccountDetailController.js';
import LedgerFormController from '../controllers/LedgerFormController.js';
import { buildDetailHandlers } from '../controllers/detailHandlers.js';
import { ledgerPageHref } from '../ledgerPageHref.js';
import Router from '../../../../../../utils/routing/Router.js';
import { currentHash, navigate } from '../../currentHash.js';
import { pageFromHash } from '../../pageQuery.js';

/**
 * State and handlers of an account detail page (`<ui><base>/:accountId[?page=N]`), shared by
 * the Accounts, Debts and Investments sections.
 *
 * @description The owner context and the account id are captured on mount (the page is
 * remounted on a context change, see AppHelper); the ledger page lives in the hash query, so
 * reload / back / forward keep it. Deleting the account returns to the section list and a
 * create on another page goes to `<base>/:accountId?page=1`. An account of another type is
 * redirected to its own section (see `guardAccountType`). `reload` and `ledgerForm` let a
 * section add its own page pieces (e.g. Investments' Update value form, which posts directly,
 * asks before discarding the inline form's unsaved changes and reloads); `setError` lets them
 * report into the page alert (e.g. Providers' Mark as unsent).
 * @param {string} base - The section base path (e.g. `'/bank/accounts'`, `'/bank/debts'`).
 * @returns {{context: object, notFound: boolean, state: object, handlers: object,
 *   reload: Function, setError: Function, ledgerForm: {form: object, actions: object}}} The
 *   owner context, whether to show Not-found, the helper state (`context`, `accountId`,
 *   `page`, `data`, `loadError`, `error`, `form`, `actionPending`, `confirmation`), every
 *   handler (see `buildDetailHandlers`), the account + ledger reload, the page alert's error
 *   setter and the inline form's state and actions.
 */
export default function useAccountDetail(base) {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [accountId] = useState(() => Router.extractContextParams(`${base}/:accountId`, currentHash()).accountId);
  const page = pageFromHash(currentHash());
  const ledger = useAccountLedger(context, accountId, page, base);
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
    listPath: base,
  }), [context, accountId, reload, setNotFound, base]);
  const ledgerController = useMemo(() => new LedgerFormController({
    context,
    accountId,
    update: actions.update,
    reset: actions.reset,
    setError,
    reload,
    goToFirstPage: () => navigate(ledgerPageHref(context, base, accountId, 1)),
  }), [context, accountId, actions, reload, base]);

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

  return {
    context,
    notFound: ledger.notFound,
    state: {
      context,
      accountId,
      page,
      data: ledger.data,
      loadError: ledger.loadError,
      error,
      form,
      actionPending,
      confirmation,
    },
    handlers,
    reload,
    setError,
    ledgerForm: { form, actions },
  };
}
