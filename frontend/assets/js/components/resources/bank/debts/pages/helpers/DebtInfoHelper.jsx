import DetailEntry from '../../../common/detail/DetailEntry.jsx';
import { formatMoney, negateAmount } from '../../../common/amounts.js';
import { formatRate } from '../../../common/rates.js';

/** Display labels of the instalment frequency. */
const FREQUENCY_LABELS = new Map([
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
]);

/**
 * Name a month (1–12) in the browser's locale.
 *
 * @param {number|null} month - The 1-based month.
 * @returns {string} The month name, or `''` when unset.
 */
export function monthName(month) {
  if (!month) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, month - 1, 1));
}

/**
 * Render the common fields of a debt: creditor, currency, loan date, amount owed (the opening
 * balance negated, as typed on the form) and notes.
 *
 * @param {object} account - The debt account.
 * @returns {React.ReactElement} The definition list.
 */
function renderAccountFields(account) {
  return (
    <dl className="row">
      <DetailEntry label="Creditor" value={account.bank_name} />
      <DetailEntry label="Currency" value={account.currency} />
      <DetailEntry label="Loan date" value={account.opening_date} />
      <DetailEntry label="Amount owed" value={formatMoney(negateAmount(account.opening_balance), account.currency)} />
      <DetailEntry label="Notes" value={account.notes} />
    </dl>
  );
}

/**
 * Render the debt info block: interest rate and period, instalment amount, frequency, due day,
 * due month and instalment count.
 *
 * @param {object} account - The debt account.
 * @returns {React.ReactElement} The definition list.
 */
function renderDebtFields(account) {
  const debt = account.debt ?? {};

  return (
    <dl className="row" aria-label="Debt info">
      <DetailEntry label="Interest rate" value={formatRate(debt.interest_rate, debt.interest_period)} />
      <DetailEntry label="Instalment amount" value={formatMoney(debt.instalment_amount, account.currency)} />
      <DetailEntry label="Frequency" value={FREQUENCY_LABELS.get(debt.instalment_frequency)} />
      <DetailEntry label="Due day" value={debt.due_day ? String(debt.due_day) : ''} />
      <DetailEntry label="Due month" value={monthName(debt.due_month)} />
      <DetailEntry label="Instalment count" value={debt.instalment_count ? String(debt.instalment_count) : ''} />
    </dl>
  );
}

/**
 * Rendering helper for the debt details shown in the debt detail header.
 */
const DebtInfoHelper = {
  /**
   * Render the debt's details: its common fields (creditor, currency, loan date, amount owed,
   * notes), then the debt info block. Unset values show `—`.
   *
   * @param {object} account - The debt account (with its `debt` object).
   * @returns {React.ReactElement} The details.
   */
  render(account) {
    return (
      <>
        {renderAccountFields(account)}
        <h2 className="h5">Debt info</h2>
        {renderDebtFields(account)}
      </>
    );
  },
};

export default DebtInfoHelper;
