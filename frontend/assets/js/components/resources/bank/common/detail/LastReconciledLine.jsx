import { formatMoney, negateAmount } from '../amounts.js';
import { formatDate } from '../dates.js';

/**
 * The "Last reconciled" header line of an account: the date and the balance of its last finished
 * statement. The balance is shown the way the reconciliation screens show it, negated on a debt.
 *
 * @param {{account: {type: string, currency: string, last_reconciliation: (object|null)}}} props -
 *   The account detail (`last_reconciliation`: `{ statement_date, statement_balance }` or `null`).
 * @returns {React.ReactElement|null} The line, or `null` when the account was never reconciled.
 */
export default function LastReconciledLine({ account }) {
  const last = account.last_reconciliation;

  if (!last) {
    return null;
  }

  const balance = account.type === 'debt' ? negateAmount(last.statement_balance) : last.statement_balance;

  return (
    <p className="text-muted">
      {`Last reconciled: ${formatDate(last.statement_date)} · ${formatMoney(balance, account.currency)}`}
    </p>
  );
}
