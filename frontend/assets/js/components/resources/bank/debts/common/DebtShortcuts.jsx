import AccountShortcuts from '../../common/detail/AccountShortcuts.jsx';
import { interestPreset, paymentPreset } from './shortcutPresets.js';

/**
 * The **Add payment** / **Add interest** shortcuts above a debt's ledger (see
 * `AccountShortcuts`); hidden on an archived debt, which is read-only.
 *
 * @param {{account: object, onStartNew: Function}} props - The debt account and the preset
 *   handler.
 * @returns {React.ReactElement} The shortcut bar.
 */
export default function DebtShortcuts({ account, onStartNew }) {
  const shortcuts = [
    ['Add payment', 'outline-success', paymentPreset(account.debt)],
    ['Add interest', 'outline-danger', interestPreset()],
  ];

  return <AccountShortcuts account={account} shortcuts={shortcuts} onStartNew={onStartNew} />;
}
