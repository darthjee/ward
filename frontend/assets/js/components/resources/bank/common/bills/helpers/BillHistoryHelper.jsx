import Table from 'react-bootstrap/cjs/Table.js';
import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../BankErrorAlert.jsx';
import BankPagination from '../../BankPagination.jsx';
import OffScheduleBadge from '../OffScheduleBadge.jsx';
import UndoPaymentConfirm, { undoWarnsCharge } from '../UndoPaymentConfirm.jsx';
import { formatMoney } from '../../amounts.js';
import { formatDate } from '../../dates.js';

/** Display labels of a bill payment's status. */
const STATUS_LABELS = new Map([
  ['paid', 'Paid'],
  ['skipped', 'Skipped'],
]);

/** Empty-state text of the Bill history. */
export const EMPTY_HISTORY_TEXT = 'No bills paid or skipped yet.';

/**
 * Render a row's Undo button, hidden while the account is archived.
 *
 * @param {object} payment - The history row.
 * @param {object} state - Helper state (`account`, `pending`).
 * @param {{onUndo: Function}} handlers - Row handlers.
 * @returns {React.ReactElement|null} The actions cell, or `null` on an archived account.
 */
function renderUndo(payment, state, handlers) {
  if (state.account.archived_at) {
    return null;
  }

  return (
    <td className="text-end text-nowrap">
      <Button size="sm" variant="link" onClick={() => handlers.onUndo(payment)} disabled={state.pending}>Undo</Button>
    </td>
  );
}

/**
 * Render one history row: status (with the Off-schedule mark), due date, paid-on, amount,
 * paying account and the one-off bill's description.
 *
 * @param {object} payment - The history row.
 * @param {object} state - Helper state.
 * @param {object} handlers - Row handlers.
 * @returns {React.ReactElement} The row.
 */
function renderRow(payment, state, handlers) {
  return (
    <tr key={`${payment.id}-${payment.due_date}`}>
      <td className="text-nowrap">
        {STATUS_LABELS.get(payment.status) ?? payment.status}
        <OffScheduleBadge payment={payment} />
      </td>
      <td className="text-nowrap">{formatDate(payment.due_date)}</td>
      <td className="text-nowrap">{payment.paid_on ? formatDate(payment.paid_on) : '—'}</td>
      <td className="text-end text-nowrap">{formatMoney(payment.amount, state.account.currency) || '—'}</td>
      <td className="text-break">{payment.paying_account?.name ?? '—'}</td>
      <td className="text-break">{payment.bill?.description ?? ''}</td>
      {renderUndo(payment, state, handlers)}
    </tr>
  );
}

/**
 * Render the header of the actions column, hidden while the account is archived.
 *
 * @param {object} account - The account.
 * @returns {React.ReactElement|null} The header cell, or `null`.
 */
function renderActionsHeader(account) {
  return account.archived_at ? null : <th aria-label="Actions" />;
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

  if (state.data.payments.length === 0) {
    return <p className="text-muted">{EMPTY_HISTORY_TEXT}</p>;
  }

  return (
    <Table size="sm" responsive aria-label="Bill history">
      <thead>
        <tr>
          <th>Status</th>
          <th>Due date</th>
          <th>Paid on</th>
          <th className="text-end">Amount</th>
          <th>Paying account</th>
          <th>Bill</th>
          {renderActionsHeader(state.account)}
        </tr>
      </thead>
      <tbody>{state.data.payments.map((payment) => renderRow(payment, state, handlers))}</tbody>
    </Table>
  );
}

/**
 * Render the Undo confirmation of the selected row.
 *
 * @param {object} state - Helper state (`confirmation`, `sourceType`, `pending`).
 * @param {object} handlers - `onConfirmUndo` / `onCancelUndo`.
 * @returns {React.ReactElement} The modal.
 */
function renderConfirm(state, handlers) {
  const row = state.confirmation;
  const warn = Boolean(row) && undoWarnsCharge({
    status: row.status, sourceType: state.sourceType, isOneOff: Boolean(row.bill),
  });

  return (
    <UndoPaymentConfirm
      show={Boolean(row)}
      showChargeWarning={warn}
      pending={state.pending}
      onConfirm={handlers.onConfirmUndo}
      onCancel={handlers.onCancelUndo}
    />
  );
}

/**
 * Rendering helper of an account's **Bill history** (debt / provider detail pages).
 */
const BillHistoryHelper = {
  /**
   * Render the Bill history: heading, alert, the rows as returned (newest due date first),
   * the pagination and the Undo confirmation. Amounts use the account's currency (rows carry
   * none); every value is rendered as escaped text.
   *
   * @param {{account: object, sourceType: string, page: number, data: (object|null),
   *   error: (object|null), pending: boolean, confirmation: (object|null),
   *   selfHref: string}} state - Helper state.
   * @param {{onNavigate: Function, onUndo: Function, onConfirmUndo: Function,
   *   onCancelUndo: Function, onRetry: Function, onDismiss: Function}} handlers - Handlers.
   * @returns {React.ReactElement} The section.
   */
  render(state, handlers) {
    return (
      <section className="mt-4" aria-label="Bill history">
        <h2 className="h4">Bill history</h2>
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderBody(state, handlers)}
        <BankPagination
          page={state.page}
          totalPages={state.data?.pagination.total_pages}
          hrefFor={() => state.selfHref}
          onNavigate={handlers.onNavigate}
        />
        {renderConfirm(state, handlers)}
      </section>
    );
  },
};

export default BillHistoryHelper;
