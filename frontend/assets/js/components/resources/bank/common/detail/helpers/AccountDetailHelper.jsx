import BankErrorAlert from '../../BankErrorAlert.jsx';
import BankPagination from '../../BankPagination.jsx';
import ConfirmModal from '../../ConfirmModal.jsx';
import { localToday } from '../../dates.js';
import LedgerFormHelper from './LedgerFormHelper.jsx';
import LedgerTableHelper from './LedgerTableHelper.jsx';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { ledgerPageHref } from '../ledgerPageHref.js';

/**
 * Render a section slot, or nothing when the section has none.
 *
 * @param {Function|undefined} slot - Renders the slot from the account, the handlers and the
 *   page state.
 * @param {object} account - The loaded account.
 * @param {object} handlers - Page handlers.
 * @param {object} state - Page state.
 * @returns {React.ReactNode} The slot content, or `null`.
 */
function renderSlot(slot, account, handlers, state) {
  return slot ? slot(account, handlers, state) : null;
}

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
 * Render the loaded page: header, alert, the section's shortcuts, ledger form, table and
 * pagination.
 *
 * @param {object} state - Page state (with `data` loaded).
 * @param {object} handlers - Page handlers.
 * @param {object} options - Section options (see `AccountDetailHelper.render`).
 * @returns {React.ReactElement} The page body.
 */
function renderLoaded(state, handlers, options) {
  const { account, ledger } = state.data;
  const readOnly = Boolean(account.archived_at);
  const hrefFor = (page) => ledgerPageHref(state.context, options.base, state.accountId, page);

  return (
    <>
      {options.renderHeader({
        account,
        hasTransactions: ledger.pagination.total_count > 0,
        actionPending: state.actionPending,
        context: state.context,
      }, handlers)}
      <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
      <h2 className="h4 mt-4">Ledger</h2>
      {renderSlot(options.renderShortcuts, account, handlers, state)}
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
 * @param {object} options - Section options.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody(state, handlers, options) {
  if (state.data) {
    return renderLoaded(state, handlers, options);
  }

  return state.loadError ? null : <p className="text-muted">Loading…</p>;
}

/**
 * Rendering helper composing the detail page shared by every account section (Accounts,
 * Debts, Investments).
 */
const AccountDetailHelper = {
  /**
   * Render an account detail page with its ledger: the back link to the section list, the
   * section's header, the alert, the optional shortcuts above the inline form, the ledger
   * table, the pagination and the delete confirmation.
   *
   * @param {{context: object, accountId: (number|string), page: number,
   *   data: ({account: object, ledger: object}|null), loadError: (object|null),
   *   error: (object|null), form: object, actionPending: (string|null),
   *   confirmation: (object|null)}} state - Page state.
   * @param {object} handlers - Page handlers (see `buildDetailHandlers`).
   * @param {{base: string, backLabel: string, renderHeader: Function,
   *   renderShortcuts: Function}} options - The section base path, the back link label, the
   *   header renderer (called with `{ account, hasTransactions, actionPending, context }` and
   *   the handlers) and the optional shortcuts renderer (called with the account, the
   *   handlers and the page state, which may carry section extras).
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers, options) {
    return (
      <div className="container mt-4">
        <p className="mb-2">
          <a href={contextHash(state.context, options.base)}>{`← ${options.backLabel}`}</a>
        </p>
        <BankErrorAlert error={state.loadError} onRetry={handlers.onRetryLoad} />
        {renderBody(state, handlers, options)}
      </div>
    );
  },
};

export default AccountDetailHelper;
