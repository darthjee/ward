import Table from 'react-bootstrap/cjs/Table.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import { formatMoney } from '../../../common/amounts.js';
import { formatRate } from '../../../common/rates.js';
import ArchivedBadge from '../../../common/list/ArchivedBadge.jsx';
import AccountListHeader from '../../../common/list/AccountListHeader.jsx';
import EmptyAccountList from '../../../common/list/EmptyAccountList.jsx';
import { INVESTMENTS_BASE as LIST_PATH } from '../../../common/sections.js';
import { kindLabel } from '../../common/investmentLabels.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

/**
 * Render one investment row; the whole row links to the investment detail page.
 *
 * @param {object} investment - The investment account (with its `investment` object).
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The row.
 */
function renderRow(investment, context) {
  const details = investment.investment ?? {};

  return (
    <tr key={investment.id} className={`position-relative${investment.archived_at ? ' text-muted' : ''}`}>
      <td className="text-break">
        <a className="stretched-link" href={contextHash(context, `${LIST_PATH}/${investment.id}`)}>{investment.name}</a>
        <ArchivedBadge account={investment} />
      </td>
      <td className="text-break">{investment.bank_name}</td>
      <td>{kindLabel(details.kind)}</td>
      <td className="text-end text-nowrap">{formatMoney(investment.balance, investment.currency)}</td>
      <td className="text-end text-nowrap">{formatRate(details.yield_rate, details.yield_period)}</td>
      <td className="text-nowrap">{details.maturity_date}</td>
      <td>{investment.currency}</td>
    </tr>
  );
}

/**
 * Render the investments table, or the empty state.
 *
 * @param {Array<object>} investments - The investments, sorted by name.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The table or the empty state.
 */
function renderInvestments(investments, context) {
  if (investments.length === 0) {
    return (
      <EmptyAccountList
        message="No investments yet"
        href={contextHash(context, `${LIST_PATH}/new`)}
        label="Create an investment"
      />
    );
  }

  return (
    <Table hover responsive>
      <thead>
        <tr>
          <th>Name</th>
          <th>Institution</th>
          <th>Kind</th>
          <th className="text-end">Current value</th>
          <th className="text-end">Yield rate</th>
          <th>Maturity date</th>
          <th>Currency</th>
        </tr>
      </thead>
      <tbody>{investments.map((investment) => renderRow(investment, context))}</tbody>
    </Table>
  );
}

/**
 * Render the body: the investments once loaded, a loading notice otherwise.
 *
 * @param {{accounts: (Array<object>|null), error: (object|null), context: object}} state -
 *   Page state.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody({ accounts, error, context }) {
  if (accounts) {
    return renderInvestments(accounts, context);
  }

  return error ? null : <p className="text-muted">Loading…</p>;
}

/**
 * Rendering helper for the Investments list page.
 */
const BankInvestmentListHelper = {
  /**
   * Render the Investments list: the header with the *Show archived* toggle and **New
   * investment**, the error alert and the investments table — name, institution, kind, current
   * value (the balance), yield rate with its period, maturity date, currency (no total row,
   * since currencies may differ).
   *
   * @param {{accounts: (Array<object>|null), error: (object|null), archived: boolean,
   *   context: object}} state - The loaded investments, the classified error, the archived
   *   filter and the active owner context.
   * @param {{onRetry: Function, onDismiss: Function}} handlers - Alert handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <AccountListHeader
          title="Investments"
          base={LIST_PATH}
          context={state.context}
          archived={state.archived}
          newLabel="New investment"
        />
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderBody(state)}
      </div>
    );
  },
};

export default BankInvestmentListHelper;
