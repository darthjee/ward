import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../BankErrorAlert.jsx';
import ConfirmModal from '../../ConfirmModal.jsx';
import { formatMoney, isZeroAmount, negateAmount } from '../../amounts.js';
import { formatDate } from '../../dates.js';
import { statementBalanceLabel } from '../controllers/statementFields.js';
import StatementFormHelper from './StatementFormHelper.jsx';

/**
 * Format a statement amount for display: a debt shows the amount owed, so it is negated.
 *
 * @param {string} amount - The API's decimal string.
 * @param {object} account - The account.
 * @returns {string} The formatted money.
 */
function display(amount, account) {
  return formatMoney(account.type === 'debt' ? negateAmount(amount) : amount, account.currency);
}

/**
 * Render the four values of the summary bar; the difference is highlighted unless it is 0.
 *
 * @param {object} statement - The open statement.
 * @param {object} account - The account.
 * @returns {React.ReactElement} The values.
 */
function renderValues(statement, account) {
  const balanced = isZeroAmount(statement.difference);

  return (
    <div className="d-flex flex-wrap gap-4 me-auto">
      <span>
        Statement date:
        {' '}
        <strong>{formatDate(statement.statement_date)}</strong>
      </span>
      <span>
        {`${statementBalanceLabel(account)}: `}
        <strong>{display(statement.statement_balance, account)}</strong>
      </span>
      <span>
        Cleared balance:
        {' '}
        <strong>{display(statement.cleared_balance, account)}</strong>
      </span>
      <span>
        Difference:
        {' '}
        <strong className={balanced ? undefined : 'text-bg-warning px-2 rounded'}>
          {display(statement.difference, account)}
        </strong>
      </span>
    </div>
  );
}

/**
 * Render the Cancel button, offered only to a role that may cancel.
 *
 * @param {boolean} canCancel - Whether the caller's role may cancel.
 * @param {boolean} pending - Whether a request is in flight.
 * @param {Function} onCancel - Opens the confirmation.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderCancel(canCancel, pending, onCancel) {
  if (!canCancel) {
    return null;
  }

  return <Button variant="outline-danger" onClick={onCancel} disabled={pending}>Cancel</Button>;
}

/**
 * Render the Finish, Edit statement and Cancel buttons.
 *
 * @param {object} reconcile - The reconcile state.
 * @param {object} handlers - The reconcile handlers.
 * @returns {React.ReactElement} The buttons.
 */
function renderActions(reconcile, handlers) {
  const { pending, statement } = reconcile;

  return (
    <div className="d-flex flex-wrap gap-2">
      <Button onClick={handlers.onFinish} disabled={pending || !isZeroAmount(statement.difference)}>Finish</Button>
      <Button variant="outline-secondary" onClick={handlers.onEditStatement} disabled={pending}>Edit statement</Button>
      {renderCancel(reconcile.canCancel, pending, handlers.onCancel)}
    </div>
  );
}

/**
 * Render the local filter and the bulk tick buttons.
 *
 * @param {object} reconcile - The reconcile state.
 * @param {Array<object>} rows - The page's ledger rows.
 * @param {object} handlers - The reconcile handlers.
 * @returns {React.ReactElement} The toolbar.
 */
function renderToolbar(reconcile, rows, handlers) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-3 mt-2">
      <div className="form-check mb-0">
        <input
          id="reconcile-only-uncleared"
          type="checkbox"
          className="form-check-input"
          checked={reconcile.onlyUncleared}
          onChange={handlers.onToggleOnlyUncleared}
        />
        <label className="form-check-label" htmlFor="reconcile-only-uncleared">Show only uncleared</label>
      </div>
      <Button size="sm" variant="outline-primary" onClick={() => handlers.onTickAll(rows)}>Tick all on page</Button>
      <Button size="sm" variant="outline-primary" onClick={() => handlers.onUntickAll(rows)}>Untick all</Button>
    </div>
  );
}

/**
 * Render the sticky summary bar with its actions, toolbar, alert and the Cancel confirmation.
 *
 * @param {{account: object, rows: Array<object>, reconcile: object}} state - Section state.
 * @param {object} handlers - The reconcile handlers.
 * @returns {React.ReactElement} The bar.
 */
function renderBar({ account, rows, reconcile }, handlers) {
  return (
    <div className="sticky-top bg-body border rounded p-3 mb-3" aria-label="Reconciliation">
      <div className="d-flex flex-wrap align-items-center gap-3">
        {renderValues(reconcile.statement, account)}
        {renderActions(reconcile, handlers)}
      </div>
      {renderToolbar(reconcile, rows, handlers)}
      <BankErrorAlert error={reconcile.error} onDismiss={handlers.onDismissError} />
      <ConfirmModal
        show={reconcile.cancelConfirm}
        title="Cancel reconciliation"
        confirmLabel="Cancel reconciliation"
        pending={reconcile.pending}
        onConfirm={handlers.onConfirmCancel}
        onCancel={handlers.onDismissCancel}
      >
        Cancel this reconciliation? Every tick of the statement is dropped.
      </ConfirmModal>
    </div>
  );
}

/**
 * Rendering helper of the reconcile section shown after the account header: nothing, the
 * statement form, or the summary bar.
 */
const ReconcileSectionHelper = {
  /**
   * Render the reconcile section for the current mode.
   *
   * @param {{account: object, today: string, rows: Array<object>, reconcile: object}} state -
   *   The loaded account, local today, the page's ledger rows and the reconcile state (`mode`,
   *   `statement`, `error`, `pending`, `cancelConfirm`, `onlyUncleared`, `canCancel`, ...).
   * @param {object} handlers - The reconcile handlers (see `buildReconcileHandlers`).
   * @returns {React.ReactElement|null} The form, the summary bar, or `null` when the mode is
   *   off.
   */
  render(state, handlers) {
    const { reconcile } = state;

    if (reconcile?.mode === 'form') {
      return StatementFormHelper.render(state, handlers);
    }

    return reconcile?.mode === 'active' ? renderBar(state, handlers) : null;
  },
};

export default ReconcileSectionHelper;
