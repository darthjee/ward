import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import BankPagination from '../../../common/BankPagination.jsx';
import ConfirmModal from '../../../common/ConfirmModal.jsx';
import { localToday } from '../../../common/dates.js';
import BankAccountHeaderHelper from './BankAccountHeaderHelper.jsx';
import LedgerFormHelper from '../../../common/detail/helpers/LedgerFormHelper.jsx';
import LedgerTableHelper from '../../../common/detail/helpers/LedgerTableHelper.jsx';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { ledgerPageHref } from '../../../common/detail/ledgerPageHref.js';

/** Section base of the Accounts submenu. */
export const ACCOUNTS_BASE = '/bank/accounts';

/**
 * Render the inline form row, hidden on an archived account.
 *
 * @param {boolean} readOnly - Whether the account is archived.
 * @param {object} form - The form state.
 * @param {object} handlers - Form handlers.
 * @returns {React.ReactElement|null} The form, or `null`.
 */
function renderForm(readOnly, form, handlers) {
  if (readOnly) {
    return null;
  }

  return LedgerFormHelper.render({ form, today: localToday(), idPrefix: 'ledger-' }, handlers);
}

/**
 * Render the delete confirmation for the account or a transaction.
 *
 * @param {object|null} confirmation - The open confirmation.
 * @param {boolean} pending - Whether the delete is in flight.
 * @param {object} handlers - `onConfirm` / `onCancelConfirm`.
 * @returns {React.ReactElement} The modal.
 */
function renderConfirm(confirmation, pending, handlers) {
  const transaction = confirmation?.transaction;
  const body = transaction
    ? `Delete the transaction “${transaction.description}”? This cannot be undone.`
    : 'Delete this account? This cannot be undone.';

  return (
    <ConfirmModal
      show={Boolean(confirmation)}
      title={transaction ? 'Delete transaction' : 'Delete account'}
      pending={pending}
      onConfirm={handlers.onConfirm}
      onCancel={handlers.onCancelConfirm}
    >
      {body}
    </ConfirmModal>
  );
}

/**
 * Render the loaded page: header, alert, ledger form, table and pagination.
 *
 * @param {object} state - Page state (with `data` loaded).
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The page body.
 */
function renderLoaded(state, handlers) {
  const { account, ledger } = state.data;
  const readOnly = Boolean(account.archived_at);
  const hrefFor = (page) => ledgerPageHref(state.context, ACCOUNTS_BASE, state.accountId, page);

  return (
    <>
      {BankAccountHeaderHelper.render({
        account,
        hasTransactions: ledger.pagination.total_count > 0,
        actionPending: state.actionPending,
        context: state.context,
      }, handlers)}
      <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
      <h2 className="h4 mt-4">Ledger</h2>
      {renderForm(readOnly, state.form, handlers)}
      {LedgerTableHelper.render({
        ledger,
        currency: account.currency,
        editingId: state.form.editing?.id ?? null,
        readOnly,
        busy: Boolean(state.actionPending),
        page: state.page,
        firstPageHref: hrefFor(1),
      }, handlers)}
      <BankPagination
        page={state.page}
        totalPages={ledger.pagination.total_pages}
        hrefFor={hrefFor}
        onNavigate={handlers.onNavigate}
      />
      {renderConfirm(state.confirmation, state.actionPending === 'delete', handlers)}
    </>
  );
}

/**
 * Render the body: the loaded page, or a loading notice.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody(state, handlers) {
  if (state.data) {
    return renderLoaded(state, handlers);
  }

  return state.loadError ? null : <p className="text-muted">Loading…</p>;
}

/**
 * Rendering helper composing the account detail page.
 */
const BankAccountDetailHelper = {
  /**
   * Render the account detail page with its ledger.
   *
   * @param {{context: object, accountId: (number|string), page: number,
   *   data: ({account: object, ledger: object}|null), loadError: (object|null),
   *   error: (object|null), form: object, actionPending: (string|null),
   *   confirmation: (object|null)}} state - Page state.
   * @param {object} handlers - Page handlers (see `buildDetailHandlers`).
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <p className="mb-2">
          <a href={contextHash(state.context, ACCOUNTS_BASE)}>← Accounts</a>
        </p>
        <BankErrorAlert error={state.loadError} onRetry={handlers.onRetryLoad} />
        {renderBody(state, handlers)}
      </div>
    );
  },
};

export default BankAccountDetailHelper;
