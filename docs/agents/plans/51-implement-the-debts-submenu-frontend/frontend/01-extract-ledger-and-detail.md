# Extract the ledger and detail plumbing into bank/common

Pure refactor, no behaviour change. Move the parts of the Accounts detail page that a debt
detail page needs unchanged into `components/resources/bank/common/` (keep a `ledger/` or
`detail/` subfolder if it helps readability), and point the Accounts pages at the new
locations. Parameterise the only hardcoded path: `ledgerPageHref` must take the section base
(e.g. `'/bank/accounts'` / `'/bank/debts'`) instead of building `/bank/accounts/${id}`.

Also extend the inline ledger form so it can be opened with a preset, which the debt shortcuts
need in step 06:

- add `startNew(preset)` to `ledgerFormActions` (`hooks/useLedgerForm.js`): it sets
  `editing: null`, `values = { ...emptyLedgerValues(today), ...preset }`, `baseline` = those
  same values, clears `fieldErrors` / `error`;
- expose a handler (in `detailHandlers` / form handlers) that runs `canDiscard()` first when the
  form is dirty or editing, then calls `startNew(preset)`.

Add specs for `startNew` and the guarded handler; move the existing specs alongside their
sources and keep them passing.

## Files to Change
- `components/resources/bank/accounts/pages/helpers/LedgerTableHelper.jsx` → `bank/common/…`
- `components/resources/bank/accounts/pages/helpers/LedgerFormHelper.jsx` → `bank/common/…`
- `components/resources/bank/accounts/pages/controllers/ledgerFormFields.js` → `bank/common/…`
- `components/resources/bank/accounts/pages/controllers/LedgerFormController.js` → `bank/common/…`
- `components/resources/bank/accounts/pages/hooks/useLedgerForm.js` → `bank/common/…` — add `startNew(preset)`
- `components/resources/bank/accounts/pages/hooks/useAccountLedger.js` → `bank/common/…`
- `components/resources/bank/accounts/pages/controllers/BankAccountLoader.js` → `bank/common/…`
- `components/resources/bank/accounts/pages/controllers/BankAccountDetailController.js` → `bank/common/…`
- `components/resources/bank/accounts/pages/controllers/detailHandlers.js` → `bank/common/…` — add the guarded preset handler
- `components/resources/bank/accounts/pages/helpers/BankAccountDetailHelper.jsx` — `ledgerPageHref(base, id, page)`; consume the moved parts
- `components/resources/bank/accounts/pages/BankAccountDetail.jsx` — new imports, pass `'/bank/accounts'` as base
- Matching specs under `frontend/specs/assets/js/components/resources/bank/…` — moved with their sources; new specs for `startNew` and the preset handler
