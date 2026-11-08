import Button from 'react-bootstrap/cjs/Button.js';
import { interestPreset, paymentPreset } from './shortcutPresets.js';

/**
 * The **Add payment** / **Add interest** shortcuts above a debt's ledger. Each opens the inline
 * add form with a preset (through `onStartNew`, which asks before discarding unsaved changes);
 * hidden on an archived debt, which is read-only.
 *
 * @param {{account: object, onStartNew: Function}} props - The debt account and the preset
 *   handler.
 * @returns {React.ReactElement|null} The shortcuts, or `null` on an archived debt.
 */
export default function DebtShortcuts({ account, onStartNew }) {
  if (account.archived_at) {
    return null;
  }

  return (
    <div className="d-flex gap-2 mb-2">
      <Button size="sm" variant="outline-success" onClick={() => onStartNew(paymentPreset(account.debt))}>
        Add payment
      </Button>
      <Button size="sm" variant="outline-danger" onClick={() => onStartNew(interestPreset())}>
        Add interest
      </Button>
    </div>
  );
}
