import AccountShortcuts from '../../common/detail/AccountShortcuts.jsx';
import UpdateValueForm from './UpdateValueForm.jsx';
import { applicationPreset, withdrawalPreset } from './shortcutPresets.js';

/**
 * The **Add application** / **Add withdrawal** shortcuts and the **Update value** form above an
 * investment's ledger (see `AccountShortcuts`); all hidden on an archived investment, which is
 * read-only.
 *
 * @param {{account: object, onStartNew: Function, updateValue: object,
 *   handlers: object}} props - The investment account, the preset handler, the Update value
 *   form state and its handlers.
 * @returns {React.ReactElement} The shortcut bar.
 */
export default function InvestmentShortcuts({
  account, onStartNew, updateValue, handlers,
}) {
  const shortcuts = [
    ['Add application', 'outline-success', applicationPreset()],
    ['Add withdrawal', 'outline-danger', withdrawalPreset()],
  ];

  return (
    <AccountShortcuts account={account} shortcuts={shortcuts} onStartNew={onStartNew}>
      <UpdateValueForm state={updateValue} currency={account.currency} handlers={handlers} />
    </AccountShortcuts>
  );
}
