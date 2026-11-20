import AccountShortcuts from '../../common/detail/AccountShortcuts.jsx';
import useRecurringBills from './hooks/useRecurringBills.js';
import { providerShortcuts } from './shortcutPresets.js';

/**
 * The **Add charge** / **Add payment** shortcuts above a provider's ledger (see
 * `AccountShortcuts`), followed by the optional `children` (e.g. **Add bill**); hidden on an
 * archived provider, which is read-only.
 *
 * @description **Add charge** suggests the expected amount of the provider's single recurring
 * bill, fetched once (see `useRecurringBills`); empty with zero or several.
 * @param {{context: object, account: object, onStartNew: Function,
 *   children: React.ReactNode}} props - The owner context, the provider account, the preset
 *   handler and extra items of the bar.
 * @returns {React.ReactElement|null} The shortcut bar, or `null` when archived.
 */
export default function ProviderShortcuts({
  context, account, onStartNew, children,
}) {
  const recurring = useRecurringBills({ context, account });

  return (
    <AccountShortcuts account={account} shortcuts={providerShortcuts(recurring)} onStartNew={onStartNew}>
      {children}
    </AccountShortcuts>
  );
}
