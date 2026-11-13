import AccountShortcuts from '../../common/detail/AccountShortcuts.jsx';
import { chargePreset, paymentPreset } from './shortcutPresets.js';

/**
 * The **Add charge** / **Add payment** shortcuts above a provider's ledger (see
 * `AccountShortcuts`), followed by the optional `children` (e.g. **Add bill**); hidden on an
 * archived provider, which is read-only.
 *
 * @param {{account: object, onStartNew: Function, children: React.ReactNode}} props - The
 *   provider account, the preset handler and extra items of the bar.
 * @returns {React.ReactElement|null} The shortcut bar, or `null` when archived.
 */
export default function ProviderShortcuts({ account, onStartNew, children }) {
  const shortcuts = [
    ['Add charge', 'outline-danger', chargePreset(account.provider_expense)],
    ['Add payment', 'outline-success', paymentPreset()],
  ];

  return (
    <AccountShortcuts account={account} shortcuts={shortcuts} onStartNew={onStartNew}>
      {children}
    </AccountShortcuts>
  );
}
