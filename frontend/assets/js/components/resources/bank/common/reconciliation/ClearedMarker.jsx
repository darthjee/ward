import { formatDate } from '../dates.js';
import { isCleared } from './controllers/eligibility.js';

/**
 * The tooltip text of the cleared marker.
 *
 * @param {string} date - The statement date, already formatted for display.
 * @returns {string} The tooltip text.
 */
export const clearedTitle = (date) => `Cleared on statement of ${date}`;

/**
 * The "cleared" marker of a ledger row, rendered only for a row cleared by a finished statement.
 *
 * @param {{transaction: object}} props - The ledger row (`reconciliation`).
 * @returns {React.ReactElement|null} The marker, or `null` when the row is not cleared (this
 *   includes a row on an open statement).
 */
export default function ClearedMarker({ transaction }) {
  if (!isCleared(transaction)) {
    return null;
  }

  return (
    <span className="badge text-bg-success ms-2" title={clearedTitle(formatDate(transaction.reconciliation.statement_date))}>
      ✓ cleared
    </span>
  );
}
