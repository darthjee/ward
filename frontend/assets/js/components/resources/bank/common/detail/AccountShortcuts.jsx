import Button from 'react-bootstrap/cjs/Button.js';

/**
 * The shortcut bar above an account's ledger (e.g. Debts' Add payment / Add interest,
 * Investments' Add application / Add withdrawal). Each button opens the inline add form with
 * its preset (through `onStartNew`, which asks before discarding unsaved changes); hidden on an
 * archived account, which is read-only.
 *
 * @description `shortcuts` is a list of `[label, variant, preset]`, where `variant` is a
 * Bootstrap button variant and `preset` the inline form preset. `children` render after the
 * buttons (e.g. Investments' Update value form).
 * @param {{account: object, shortcuts: Array<Array>, onStartNew: Function,
 *   children: React.ReactNode}} props - The account, the shortcuts, the preset handler and the
 *   optional extra content.
 * @returns {React.ReactElement|null} The shortcuts, or `null` on an archived account.
 */
export default function AccountShortcuts({
  account, shortcuts, onStartNew, children,
}) {
  if (account.archived_at) {
    return null;
  }

  return (
    <div className="d-flex flex-wrap align-items-start gap-2 mb-2">
      {shortcuts.map(([label, variant, preset]) => (
        <Button key={label} size="sm" variant={variant} onClick={() => onStartNew(preset)}>
          {label}
        </Button>
      ))}
      {children}
    </div>
  );
}
