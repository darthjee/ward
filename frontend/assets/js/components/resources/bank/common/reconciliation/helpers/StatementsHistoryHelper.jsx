import Table from 'react-bootstrap/cjs/Table.js';
import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../BankErrorAlert.jsx';
import BankPagination from '../../BankPagination.jsx';
import UndoReconciliationConfirm from '../UndoReconciliationConfirm.jsx';
import { formatMoney, negateAmount } from '../../amounts.js';
import { formatDate } from '../../dates.js';
import { statementBalanceLabel } from '../controllers/statementFields.js';

/** Empty-state text of the Statements history. */
export const EMPTY_STATEMENTS_TEXT = 'No statements yet.';

/**
 * Whether the Undo column is shown: the caller's role may undo reconciliations.
 *
 * @param {{canUndo: boolean}} state - Helper state.
 * @returns {boolean} True when Undo is offered.
 */
function showsUndo(state) {
  return Boolean(state.canUndo);
}

/**
 * Render a row's Undo button, only on the undoable statement and to a role that may undo.
 *
 * @param {object} row - The history row.
 * @param {object} state - Helper state (`pending`, `canUndo`).
 * @param {{onUndo: Function}} handlers - Row handlers.
 * @returns {React.ReactElement|null} The actions cell, or `null` when Undo is not offered.
 */
function renderUndo(row, state, handlers) {
  if (!showsUndo(state)) {
    return null;
  }

  return (
    <td className="text-end text-nowrap">
      {row.undoable
        ? <Button size="sm" variant="link" onClick={() => handlers.onUndo(row)} disabled={state.pending}>Undo</Button>
        : null}
    </td>
  );
}

/**
 * The statement balance of a row, shown as the amount owed on a debt.
 *
 * @param {object} row - The history row.
 * @param {object} account - The account.
 * @returns {string} The formatted money.
 */
function balanceOf(row, account) {
  const amount = account.type === 'debt' ? negateAmount(row.statement_balance) : row.statement_balance;

  return formatMoney(amount, account.currency);
}

/**
 * Render one history row: statement date, balance, reconciled-on (Open while unfinished), the
 * number of transactions and the Undo button.
 *
 * @param {object} row - The history row.
 * @param {object} state - Helper state.
 * @param {object} handlers - Row handlers.
 * @returns {React.ReactElement} The row.
 */
function renderRow(row, state, handlers) {
  return (
    <tr key={row.id}>
      <td className="text-nowrap">{formatDate(row.statement_date)}</td>
      <td className="text-end text-nowrap">{balanceOf(row, state.account)}</td>
      <td className="text-nowrap">{row.reconciled_at ? formatDate(String(row.reconciled_at).slice(0, 10)) : 'Open'}</td>
      <td className="text-end">{row.transaction_count}</td>
      {renderUndo(row, state, handlers)}
    </tr>
  );
}

/**
 * Render the history table, an empty state, or a loading notice.
 *
 * @param {object} state - Helper state.
 * @param {object} handlers - Row handlers.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody(state, handlers) {
  if (!state.data) {
    return state.error ? null : <p className="text-muted">Loading…</p>;
  }

  if (state.data.reconciliations.length === 0) {
    return <p className="text-muted">{EMPTY_STATEMENTS_TEXT}</p>;
  }

  return (
    <Table size="sm" responsive aria-label="Statements">
      <thead>
        <tr>
          <th>Statement date</th>
          <th className="text-end">{statementBalanceLabel(state.account)}</th>
          <th>Reconciled</th>
          <th className="text-end">Transactions</th>
          {showsUndo(state) ? <th aria-label="Actions" /> : null}
        </tr>
      </thead>
      <tbody>{state.data.reconciliations.map((row) => renderRow(row, state, handlers))}</tbody>
    </Table>
  );
}

/**
 * Rendering helper of an account's **Statements history**.
 */
const StatementsHistoryHelper = {
  /**
   * Render the Statements history: heading, alert, the rows as returned (newest first, the open
   * statement on top), the pagination and the Undo confirmation. Every value is rendered as
   * escaped text.
   *
   * @param {{account: object, page: number, data: (object|null), error: (object|null),
   *   pending: boolean, confirmation: (object|null), selfHref: string, canUndo: boolean}}
   *   state - Helper state (`canUndo`: whether the caller's role may undo reconciliations).
   * @param {{onNavigate: Function, onUndo: Function, onConfirmUndo: Function,
   *   onCancelUndo: Function, onRetry: Function, onDismiss: Function}} handlers - Handlers.
   * @returns {React.ReactElement} The section.
   */
  render(state, handlers) {
    return (
      <section className="mt-4" aria-label="Statements history">
        <h2 className="h4">Statements history</h2>
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderBody(state, handlers)}
        <BankPagination
          page={state.page}
          totalPages={state.data?.pagination.total_pages}
          hrefFor={() => state.selfHref}
          onNavigate={handlers.onNavigate}
        />
        <UndoReconciliationConfirm
          show={Boolean(state.confirmation)}
          pending={state.pending}
          onConfirm={handlers.onConfirmUndo}
          onCancel={handlers.onCancelUndo}
        />
      </section>
    );
  },
};

export default StatementsHistoryHelper;
