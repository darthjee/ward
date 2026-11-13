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

/** Warning shown before changing or deleting a charge already sent to the accountant. */
export const SENT_WARNING = 'This charge was already sent to the accountant; the copy they '
  + 'hold will not change.';

/**
 * Build the delete-transaction body, warning when the charge was already sent.
 *
 * @param {object} transaction - The transaction to delete.
 * @returns {string} The body.
 */
function transactionBody(transaction) {
  const body = `Delete the transaction “${transaction.description}”? This cannot be undone.`;

  return transaction.sent_to_accountant_at ? `${body} ${SENT_WARNING}` : body;
}

/** Title, body and confirm label per confirmation kind. */
const CONFIRM_KINDS = new Map([
  ['account', {
    title: 'Delete account',
    body: () => 'Delete this account? This cannot be undone.',
    confirmLabel: 'Delete',
  }],
  ['transaction', {
    title: 'Delete transaction',
    body: (confirmation) => transactionBody(confirmation.transaction),
    confirmLabel: 'Delete',
  }],
  ['sentEdit', {
    title: 'Save sent charge',
    body: () => `${SENT_WARNING} Save the change anyway?`,
    confirmLabel: 'Save',
  }],
]);

/**
 * Whether the open confirmation's action is in flight.
 *
 * @param {object|null} confirmation - The open confirmation.
 * @param {object} state - Page state (`actionPending`, `form`).
 * @returns {boolean} True while the confirmed action runs.
 */
function confirmPending(confirmation, state) {
  if (confirmation?.kind === 'sentEdit') {
    return Boolean(state.form.pending);
  }

  return state.actionPending === 'delete';
}

/**
 * Render the confirmation for the open kind (delete account, delete transaction, save a sent
 * charge).
 *
 * @param {object|null} confirmation - The open confirmation (`{ kind, transaction }`).
 * @param {object} state - Page state.
 * @param {object} handlers - `onConfirm` / `onCancelConfirm`.
 * @returns {React.ReactElement} The modal.
 */
function renderConfirm(confirmation, state, handlers) {
  const kind = CONFIRM_KINDS.get(confirmation?.kind) ?? CONFIRM_KINDS.get('account');

  return (
    <ConfirmModal
      show={Boolean(confirmation)}
      title={kind.title}
      confirmLabel={kind.confirmLabel}
      pending={confirmPending(confirmation, state)}
      onConfirm={handlers.onConfirm}
      onCancel={handlers.onCancelConfirm}
    >
      {confirmation ? kind.body(confirmation) : null}
    </ConfirmModal>
  );
}

/**
 * Bind the section's optional per-row slot to the page handlers and state.
 *
 * @param {Function|undefined} slot - `renderRowExtra(transaction, handlers, state)`.
 * @param {object} handlers - Page handlers.
 * @param {object} state - Page state.
 * @returns {Function|undefined} The table's `renderRowExtra(transaction)`, or `undefined`.
 */
function bindRowExtra(slot, handlers, state) {
  return slot ? (transaction) => slot(transaction, handlers, state) : undefined;
}

/**
 * Render the loaded page: header, alert, the section's shortcuts, ledger form, table,
 * pagination and the section's block after the ledger.
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
        renderRowExtra: bindRowExtra(options.renderRowExtra, handlers, state),
      }, handlers)}
      <BankPagination
        page={state.page}
        totalPages={ledger.pagination.total_pages}
        hrefFor={hrefFor}
        onNavigate={handlers.onNavigate}
      />
      {renderSlot(options.renderAfterLedger, account, handlers, state)}
      {renderConfirm(state.confirmation, state, handlers)}
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
   *   renderShortcuts: Function, renderRowExtra: Function, renderAfterLedger: Function}}
   *   options - The section base path,
   *   the back link label, the header renderer (called with `{ account, hasTransactions,
   *   actionPending, context }` and the handlers), the optional shortcuts renderer (called
   *   with the account, the handlers and the page state, which may carry section extras),
   *   the optional per-row renderer (called with the transaction, the handlers and the page
   *   state; rendered under the description, also on an archived account) and the optional
   *   block after the ledger (called with the account, the handlers and the page state, e.g.
   *   the Bill history).
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
