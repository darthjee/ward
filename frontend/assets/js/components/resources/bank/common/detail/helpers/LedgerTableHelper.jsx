import Table from 'react-bootstrap/cjs/Table.js';
import Button from 'react-bootstrap/cjs/Button.js';
import { formatMoney } from '../../amounts.js';
import { formatDate } from '../../dates.js';

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
 * Render a row's Delete button, offered only to a role that may delete.
 *
 * @param {object} transaction - The ledger row.
 * @param {{canDelete: boolean, busy: boolean}} state - Table state.
 * @param {{onDeleteTransaction: Function}} handlers - Row handlers.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderDelete(transaction, { canDelete, busy }, handlers) {
  if (!canDelete) {
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
    <tr key={transaction.id} className={editing ? 'table-warning' : undefined}>
      <td className="text-nowrap">{formatDate(transaction.date)}</td>
      <td className="text-break">
        {transaction.description}
        {renderNotes(transaction.notes)}
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
   *   firstPageHref: string, renderRowExtra: Function}} state - Table state (`canDelete`:
   *   whether the caller's role may delete transactions; `canEditPaymentTransactions`: whether
   *   it may edit payment-generated ones); the optional `renderRowExtra(transaction)` adds content under a row's
   *   description (also on an archived account).
   * @param {{onEdit: Function, onDeleteTransaction: Function}} handlers - Row handlers.
   * @returns {React.ReactElement} The rendered ledger.
   */
  render(state, handlers) {
    const { transactions, opening } = state.ledger;

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
