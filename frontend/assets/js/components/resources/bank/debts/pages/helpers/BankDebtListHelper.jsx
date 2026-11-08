import Table from 'react-bootstrap/cjs/Table.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import { formatMoney } from '../../../common/amounts.js';
import { formatInstalment, formatRate } from '../../../common/rates.js';
import ArchivedBadge from '../../../common/list/ArchivedBadge.jsx';
import AccountListHeader from '../../../common/list/AccountListHeader.jsx';
import EmptyAccountList from '../../../common/list/EmptyAccountList.jsx';
import { DEBTS_BASE as LIST_PATH } from '../../../common/sections.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

/**
 * Render one debt row; the whole row links to the debt detail page.
 *
 * @param {object} debt - The debt account (with its `debt` object).
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The row.
 */
function renderRow(debt, context) {
  const details = debt.debt ?? {};

  return (
    <tr key={debt.id} className={`position-relative${debt.archived_at ? ' text-muted' : ''}`}>
      <td className="text-break">
        <a className="stretched-link" href={contextHash(context, `${LIST_PATH}/${debt.id}`)}>{debt.name}</a>
        <ArchivedBadge account={debt} />
      </td>
      <td className="text-break">{debt.bank_name}</td>
      <td className="text-end text-nowrap">{formatMoney(debt.balance, debt.currency)}</td>
      <td className="text-end text-nowrap">
        {formatInstalment(details.instalment_amount, details.instalment_frequency, debt.currency)}
      </td>
      <td className="text-end text-nowrap">{formatRate(details.interest_rate, details.interest_period)}</td>
      <td>{debt.currency}</td>
    </tr>
  );
}

/**
 * Render the debts table, or the empty state.
 *
 * @param {Array<object>} debts - The debts, sorted by name.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The table or the empty state.
 */
function renderDebts(debts, context) {
  if (debts.length === 0) {
    return (
      <EmptyAccountList
        message="No debts yet"
        href={contextHash(context, `${LIST_PATH}/new`)}
        label="Create a debt"
      />
    );
  }

  return (
    <Table hover responsive>
      <thead>
        <tr>
          <th>Name</th>
          <th>Creditor</th>
          <th className="text-end">Balance</th>
          <th className="text-end">Instalment</th>
          <th className="text-end">Interest rate</th>
          <th>Currency</th>
        </tr>
      </thead>
      <tbody>{debts.map((debt) => renderRow(debt, context))}</tbody>
    </Table>
  );
}

/**
 * Render the body: the debts once loaded, a loading notice otherwise.
 *
 * @param {{accounts: (Array<object>|null), error: (object|null), context: object}} state -
 *   Page state.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody({ accounts, error, context }) {
  if (accounts) {
    return renderDebts(accounts, context);
  }

  return error ? null : <p className="text-muted">Loading…</p>;
}

/**
 * Rendering helper for the Debts list page.
 */
const BankDebtListHelper = {
  /**
   * Render the Debts list: the header with the *Show archived* toggle and **New debt**, the
   * error alert and the debts table — name, creditor, balance, instalment with its frequency,
   * interest rate with its period, currency (no grand total, since currencies may differ).
   *
   * @param {{accounts: (Array<object>|null), error: (object|null), archived: boolean,
   *   context: object}} state - The loaded debts, the classified error, the archived filter and
   *   the active owner context.
   * @param {{onRetry: Function, onDismiss: Function}} handlers - Alert handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <AccountListHeader
          title="Debts"
          base={LIST_PATH}
          context={state.context}
          archived={state.archived}
          newLabel="New debt"
        />
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderBody(state)}
      </div>
    );
  },
};

export default BankDebtListHelper;
