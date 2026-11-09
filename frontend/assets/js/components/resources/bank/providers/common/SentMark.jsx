import Button from 'react-bootstrap/cjs/Button.js';
import { localToday } from '../../common/dates.js';

/**
 * The sent mark of a ledger charge: "Sent <local date>" and a **Mark as unsent** link, shown
 * only when the charge carries `sent_to_accountant_at` (also on an archived provider).
 *
 * @param {{transaction: object, pending: boolean, onMarkUnsent: Function}} props - The ledger
 *   row, whether a Mark as unsent is in flight and its handler (called with the row).
 * @returns {React.ReactElement|null} The mark, or `null` for an unsent row.
 */
export default function SentMark({ transaction, pending = false, onMarkUnsent }) {
  if (!transaction.sent_to_accountant_at) {
    return null;
  }

  return (
    <div className="small text-muted">
      {`Sent ${localToday(new Date(transaction.sent_to_accountant_at))}`}
      <Button size="sm" variant="link" className="py-0" onClick={() => onMarkUnsent(transaction)} disabled={pending}>
        Mark as unsent
      </Button>
    </div>
  );
}
