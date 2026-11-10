import Table from 'react-bootstrap/cjs/Table.js';
import { formatMoney } from '../../../common/amounts.js';
import { localToday } from '../../../common/dates.js';
import { PROVIDERS_BASE } from '../../../common/sections.js';
import { EMPTY_MARK } from '../../common/providerLabels.js';
import { totalsByCurrency } from '../../common/chargeTotals.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

/**
 * Format a sent mark as the browser's local date.
 *
 * @param {string|null} sentAt - The `sent_to_accountant_at` ISO timestamp.
 * @returns {string} The local `YYYY-MM-DD` date, or "—" when unsent.
 */
function sentDate(sentAt) {
  return sentAt ? localToday(new Date(sentAt)) : EMPTY_MARK;
}

/**
 * Render one preview row: date, provider (the account name linking to its detail, with
 * `bank_name` beneath), description, amount, currency and sent date.
 *
 * @param {object} charge - The preview charge.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The row.
 */
function renderRow(charge, context) {
  const account = charge.account ?? {};

  return (
    <tr key={charge.id}>
      <td className="text-nowrap">{charge.date}</td>
      <td className="text-break">
        <a href={contextHash(context, `${PROVIDERS_BASE}/${account.id}`)}>{account.name}</a>
        <div className="small text-muted">{account.bank_name}</div>
      </td>
      <td className="text-break">{charge.description}</td>
      <td className="text-end text-nowrap">{formatMoney(charge.amount, account.currency)}</td>
      <td>{account.currency}</td>
      <td className="text-nowrap">{sentDate(charge.sent_to_accountant_at)}</td>
    </tr>
  );
}

/**
 * Render the per-currency totals, one line per currency (never a single grand total).
 *
 * @param {Array<object>} charges - The preview charges.
 * @returns {React.ReactElement} The totals.
 */
function renderTotals(charges) {
  return (
    <ul className="list-unstyled text-end" aria-label="Totals per currency">
      {totalsByCurrency(charges).map(({ currency, total }) => (
        <li key={currency}>{`Total ${currency}: ${formatMoney(total, currency)}`}</li>
      ))}
    </ul>
  );
}

/**
 * Rendering helper for the hand-off preview: the charges table and its per-currency totals.
 */
const AccountantPreviewHelper = {
  /**
   * Render the preview: a loading notice until loaded, an empty-state message without rows,
   * otherwise the table and the totals per currency.
   *
   * @param {{charges: (Array<object>|null), loading: boolean, context: object}} state - The
   *   loaded charges, whether a load is in flight and the active owner context.
   * @returns {React.ReactElement|null} The preview, or `null` when nothing is loaded.
   */
  render({ charges, loading, context }) {
    if (!charges) {
      return loading ? <p className="text-muted">Loading…</p> : null;
    }

    if (charges.length === 0) {
      return <p className="text-muted">No charges in this range.</p>;
    }

    return (
      <>
        <Table responsive size="sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Provider</th>
              <th>Description</th>
              <th className="text-end">Amount</th>
              <th>Currency</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>{charges.map((charge) => renderRow(charge, context))}</tbody>
        </Table>
        {renderTotals(charges)}
      </>
    );
  },
};

export default AccountantPreviewHelper;
