# Provider detail page: info block, shortcuts, sent marks and warnings

`<ui>/providers/:accountId`. `BankProviderDetail.jsx` uses `useAccountDetail(PROVIDERS_BASE)`
and renders through `BankProviderDetailHelper` → `AccountDetailHelper.render`.

1. **Info block.** `ProviderInfoHelper.render(account)` returns a `<dl>` of `DetailEntry`
   items:
   - provider tax id;
   - expected amount with frequency ("—" when missing);
   - frequency;
   - due day and due month (month name), each only when set;
   - for accountant.
   It is passed through `renderHeader` → `AccountHeaderHelper`'s `details`.
2. **Shortcuts.**
   - `providers/common/shortcutPresets.js`:
     - `chargePreset(details)` = `{ direction: 'out', description: 'Charge', amount:
       details?.expected_amount ?? '' }`;
     - `paymentPreset()` = `{ direction: 'in', description: 'Payment', amount: '' }`.
   - `ProviderShortcuts.jsx` wraps `AccountShortcuts` with **Add charge** / **Add payment**.
     Both are hidden on an archived account, which `AccountShortcuts` already handles.
3. **Sent marks.**
   - `useMarkUnsent` (provider hook layered on `useAccountDetail`, like
     `useUpdateValueForm`) exposes `onMarkUnsent(transaction)`. It calls
     `AccountantClient.markUnsent(context, [transaction.id])`, then `reload()`.
   - It has no confirmation. While it is in flight, a pending flag disables the link, and errors
     go to `BankErrorAlert`.
   - The helper passes `renderRowExtra`. A row whose `sent_to_accountant_at` is truthy shows
     "Sent <local date>", using `localToday(new Date(iso))`, plus a **Mark as unsent** link.
     It is rendered on archived accounts too.
4. **Warnings.** These come from step 01's confirm kinds; there is nothing provider-specific
   beyond the data. Editing a sent charge opens the "already sent" `ConfirmModal` before the
   save. Deleting one adds the warning to the usual confirm.

Specs cover:
- the info block, including the optional due fields and "—";
- the shortcuts, including the archived case, the `expected_amount` suggestion and the Out / In
  direction;
- the sent row (date, link, archived still showing the link, no Edit / Delete when archived);
- Mark as unsent posting one id and reloading;
- the edit and delete warnings;
- both contexts.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/pages/BankProviderDetail.jsx` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx`, `ProviderInfoHelper.jsx` (new)
- `frontend/assets/js/components/resources/bank/providers/common/shortcutPresets.js`, `ProviderShortcuts.jsx`, `SentMark.jsx` (new)
- `frontend/assets/js/components/resources/bank/providers/common/hooks/useMarkUnsent.js` (new)
- `frontend/assets/js/components/helpers/AppHelper.jsx` — wire `bank-provider`
- `frontend/specs/assets/js/components/resources/bank/providers/...` matching specs (`BankProviderDetailSpec`, `BankProviderDetailHelperSpec`, `ProviderInfoHelperSpec`, `shortcutPresetsSpec`, `ProviderShortcutsSpec`, `SentMarkSpec`, `useMarkUnsentSpec`) (new)
