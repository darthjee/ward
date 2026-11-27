import { formatDate } from '../dates.js';

/**
 * The text of the warning badge.
 *
 * @param {string} date - The last reconciled statement date, already formatted for display.
 * @returns {string} The badge text.
 */
export const unreconciledWarning = (date) => `Not on reconciled statement of ${date}`;

/**
 * The warning badge of a ledger row dated on or before the last reconciled statement but not
 * cleared by any statement.
 *
 * @param {{transaction: object, lastReconciledDate: (string|null|undefined)}} props - The ledger
 *   row and the account's last reconciled statement date (`YYYY-MM-DD`).
 * @returns {React.ReactElement|null} The badge, or `null` when it does not apply.
 */
export default function UnreconciledWarningBadge({ transaction, lastReconciledDate }) {
  if (transaction.reconciliation || !lastReconciledDate || transaction.date > lastReconciledDate) {
    return null;
  }

  return <span className="badge text-bg-warning ms-2">{unreconciledWarning(formatDate(lastReconciledDate))}</span>;
}
