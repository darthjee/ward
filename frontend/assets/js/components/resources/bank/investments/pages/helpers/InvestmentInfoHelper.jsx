import DetailEntry from '../../../common/detail/DetailEntry.jsx';
import { formatRate } from '../../../common/rates.js';
import { formatLiquidity, kindLabel } from '../../common/investmentLabels.js';

/**
 * Render the common fields of an investment: institution, currency, start date and notes (no
 * opening balance: an investment always starts at `0`).
 *
 * @param {object} account - The investment account.
 * @returns {React.ReactElement} The definition list.
 */
function renderAccountFields(account) {
  return (
    <dl className="row">
      <DetailEntry label="Institution" value={account.bank_name} />
      <DetailEntry label="Currency" value={account.currency} />
      <DetailEntry label="Start date" value={account.opening_date} />
      <DetailEntry label="Notes" value={account.notes} />
    </dl>
  );
}

/**
 * Render the investment info block: kind, yield rate and period, maturity date and liquidity
 * (D+N).
 *
 * @param {object} account - The investment account.
 * @returns {React.ReactElement} The definition list.
 */
function renderInvestmentFields(account) {
  const investment = account.investment ?? {};

  return (
    <dl className="row" aria-label="Investment info">
      <DetailEntry label="Kind" value={kindLabel(investment.kind)} />
      <DetailEntry label="Yield rate" value={formatRate(investment.yield_rate, investment.yield_period)} />
      <DetailEntry label="Maturity date" value={investment.maturity_date} />
      <DetailEntry label="Liquidity" value={formatLiquidity(investment.liquidity_days)} />
    </dl>
  );
}

/**
 * Rendering helper for the investment details shown in the investment detail header.
 */
const InvestmentInfoHelper = {
  /**
   * Render the investment's details: its common fields (institution, currency, start date,
   * notes), then the investment info block. Unset values show `—`.
   *
   * @param {object} account - The investment account (with its `investment` object).
   * @returns {React.ReactElement} The details.
   */
  render(account) {
    return (
      <>
        {renderAccountFields(account)}
        <h2 className="h5">Investment info</h2>
        {renderInvestmentFields(account)}
      </>
    );
  },
};

export default InvestmentInfoHelper;
