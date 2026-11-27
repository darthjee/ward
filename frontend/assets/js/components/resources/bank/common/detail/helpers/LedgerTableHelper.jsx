import Table from 'react-bootstrap/cjs/Table.js';
import Button from 'react-bootstrap/cjs/Button.js';
import { formatMoney } from '../../amounts.js';
import { formatDate } from '../../dates.js';
import TickCellHelper from '../../reconciliation/helpers/TickCellHelper.jsx';
import { isCleared, visibleRows } from '../../reconciliation/controllers/eligibility.js';
import ClearedMarker from '../../reconciliation/ClearedMarker.jsx';
import UnreconciledWarningBadge from '../../reconciliation/UnreconciledWarningBadge.jsx';

/**
 * Render a transaction's notes, read-only, beneath its description.
 *
 * @param {string|null} notes - The notes.
 * @returns {React.ReactElement|null} The notes, or `null`.
 */
function renderNotes(notes) {
  if (!notes) {
    return null;
  }

  return <div className="small text-muted text-break" style={{ whiteSpace: 'pre-wrap' }}>{notes}</div>;
}

/**
 * Render a row's Delete button, offered only to a role that may delete, and never on a cleared row.
 *
 * @param {object} transaction - The ledger row.
 * @param {{canDelete: boolean, busy: boolean}} state - Table state.
 * @param {{onDeleteTransaction: Function}} handlers - Row handlers.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderDelete(transaction, { canDelete, busy }, handlers) {
  if (!canDelete || isCleared(transaction)) {
    return null;
  }

  return (
    <Button size="sm" variant="link" className="text-danger" onClick={() => handlers.onDeleteTransaction(transaction)} disabled={busy}>
      Delete
    </Button>
  );
}

/**
 * Render a row's Edit button, hidden on a payment-generated row unless the caller's role may
 * edit payment transactions.
 *
 * @param {object} transaction - The ledger row (`payment_generated`).
 * @param {{canEditPaymentTransactions: boolean}} state - Table state.
 * @param {{onEdit: Function}} handlers - Row handlers.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderEdit(transaction, { canEditPaymentTransactions }, handlers) {
  if (transaction.payment_generated && !canEditPaymentTransactions) {
    return null;
  }

  return <Button size="sm" variant="link" onClick={() => handlers.onEdit(transaction)}>Edit</Button>;
}

/**
 * Render a row's Edit / Delete buttons (hidden on an archived account). Edit is offered on
 * ordinary rows, and on payment-generated rows only to a role that may edit payment
 * transactions; Delete only to a role that may delete.
 *
 * @param {object} transaction - The ledger row.
 * @param {{readOnly: boolean, busy: boolean, canDelete: boolean,
 *   canEditPaymentTransactions: boolean}} state - Table state.
 * @param {{onEdit: Function, onDeleteTransaction: Function}} handlers - Row handlers.
 * @returns {React.ReactElement|null} The actions cell, or `null`.
 */
function renderActions(transaction, state, handlers) {
  if (state.readOnly) {
    return null;
  }

  return (
    <td className="text-end text-nowrap">
      {renderEdit(transaction, state, handlers)}
      {renderDelete(transaction, state, handlers)}
    </td>
  );
}

/**
 * The class of a transaction row: highlighted while edited, dimmed when ineligible in reconcile
 * mode.
 *
 * @param {object} transaction - The ledger row.
 * @param {object} state - Table state.
 * @param {boolean} editing - Whether the row is being edited.
 * @returns {string|undefined} The class.
 */
function rowClassName(transaction, state, editing) {
  if (editing) {
    return 'table-warning';
  }

  return state.reconcile ? TickCellHelper.rowClassName(transaction, state.reconcile) : undefined;
}

/**
 * Render one transaction row; the row being edited is highlighted.
 *
 * @param {object} transaction - The ledger row.
 * @param {object} state - Table state.
 * @param {object} handlers - Row handlers.
 * @returns {React.ReactElement} The row.
 */
function renderRow(transaction, state, handlers) {
  const editing = state.editingId === transaction.id;

  return (
    <tr key={transaction.id} className={rowClassName(transaction, state, editing)}>
      {state.reconcile ? TickCellHelper.render(transaction, state.reconcile, handlers.reconcile) : null}
      <td className="text-nowrap">{formatDate(transaction.date)}</td>
      <td className="text-break">
        {transaction.description}
        {renderNotes(transaction.notes)}
        <ClearedMarker transaction={transaction} />
        <UnreconciledWarningBadge transaction={transaction} lastReconciledDate={state.ledger.last_reconciled_date} />
        {state.renderRowExtra ? state.renderRowExtra(transaction) : null}
      </td>
      <td className="text-end text-nowrap">{formatMoney(transaction.amount, state.currency)}</td>
      <td className="text-end text-nowrap">{formatMoney(transaction.balance, state.currency)}</td>
      {renderActions(transaction, state, handlers)}
    </tr>
  );
}

/**
 * Render the virtual opening row (last page only), muted and without actions.
 *
 * @param {object|null} opening - The ledger's `opening`.
 * @param {object} state - Table state.
 * @returns {React.ReactElement|null} The row, or `null`.
 */
function renderOpening(opening, state) {
  if (!opening) {
    return null;
  }

  return (
    <tr className="text-muted fst-italic">
      {state.reconcile ? TickCellHelper.renderEmpty() : null}
      <td className="text-nowrap">{formatDate(opening.date)}</td>
      <td>Opening balance</td>
      <td className="text-end text-nowrap">{formatMoney(opening.amount, state.currency)}</td>
      <td className="text-end text-nowrap">{formatMoney(opening.balance, state.currency)}</td>
      {state.readOnly ? null : <td />}
    </tr>
  );
}

/**
 * Rendering helper for the ledger table.
 */
const LedgerTableHelper = {
  /**
   * Render the ledger: date, description (notes beneath), amount and running balance, newest
   * first as returned, with the opening row last on the last page. A page past the end shows
   * "No transactions on this page" with a link to page 1.
   *
   * @param {{ledger: object, currency: string, editingId: (number|null), readOnly: boolean,
   *   busy: boolean, canDelete: boolean, canEditPaymentTransactions: boolean, page: number,
   *   firstPageHref: string, renderRowExtra: Function, reconcile: object}} state - Table state (`canDelete`:
   *   whether the caller's role may delete transactions; `canEditPaymentTransactions`: whether
   *   it may edit payment-generated ones); the optional `renderRowExtra(transaction)` adds content under a row's
   *   description (also on an archived account).
   * @param {{onEdit: Function, onDeleteTransaction: Function, reconcile: object}} handlers -
   *   Row handlers (`reconcile.onToggle` ticks a row). With `state.reconcile` (reconcile mode:
   *   `{ account, statement, ticked, onlyUncleared }`) a leading Cleared checkbox column is
   *   added, ineligible rows are dimmed and the opening row has no checkbox.
   * @returns {React.ReactElement} The rendered ledger.
   */
  render(state, handlers) {
    const { opening } = state.ledger;
    const transactions = state.reconcile
      ? visibleRows(state.ledger.transactions, state.reconcile, state.reconcile.onlyUncleared)
      : state.ledger.transactions;

    if (transactions.length === 0 && !opening) {
      return (
        <p className="text-muted">
          No transactions on this page.
          {' '}
          <a href={state.firstPageHref}>Go to page 1</a>
        </p>
      );
    }

    return (
      <Table responsive size="sm">
        <thead>
          <tr>
            {state.reconcile ? TickCellHelper.renderHeader() : null}
            <th>Date</th>
            <th>Description</th>
            <th className="text-end">Amount</th>
            <th className="text-end">Balance</th>
            {state.readOnly ? null : <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => renderRow(transaction, state, handlers))}
          {renderOpening(opening, state)}
        </tbody>
      </Table>
    );
  },
};

export default LedgerTableHelper;
