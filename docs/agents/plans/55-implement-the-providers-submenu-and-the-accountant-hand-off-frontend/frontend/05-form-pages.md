# Provider create and edit pages

`<ui>/providers/new` and `<ui>/providers/:accountId/edit`, mirroring the investment and debt
form pages.

1. `providerFormFields.js` exports the following, built on `accountFormFields.js` and
   `nestedFields.js`:
   - `PROVIDER_FIELD_NAMES`;
   - `emptyProviderFields()`, with `for_accountant: true` and `charge_frequency:
     'monthly'`;
   - `providerFieldsFromAccount(account)`;
   - `validateProviderFields(fields, { nameOnly, now })`;
   - `changedProviderFields(body, original)` → `changedNestedFields(body, original,
     'provider_expense')`.
   Validation mirrors the backend: `provider_tax_id` trimmed and ≤ 32 characters (blank →
   null); `expected_amount` > 0 and valid for the currency (optional); `due_day` 1–31;
   `due_month` 1–12, required when `yearly` and dropped (sent as `null` / omitted) when
   `monthly`. Mirror `debtFormFields.js`'s due-day / due-month rules. An archived account
   is name only.
2. Controllers:
   - `BankProviderFormController` extends `AccountFormController` with `base:
     PROVIDERS_BASE`, and `sendCreate` / `sendUpdate` use `createProviderExpense` /
     `updateProviderExpense`;
   - `BankProviderNewController` and `BankProviderEditController`.
3. `BankProviderFormHelper` → `AccountFormHelper.render` with:
   - `labels: { bank_name: 'Provider' }`;
   - `renderBankExtras` from the shared renderer of step 01 (Branch, optional; "Customer /
     contract number");
   - `renderExtraFields` for: For accountant (`AccountFormCheckbox`, on by default),
     Provider tax id, Expected amount, Frequency (`PERIOD_OPTIONS` monthly / yearly), Due day,
     and Due month (a `monthName` select shown only for `yearly`, as `BankDebtFormHelper`
     does).
   No `type` field. Keep the opening balance (the anchor, any sign).
4. Pages:
   - `BankProviderNew.jsx` uses `useAccountNewPage` with id prefix `bank-provider-new-`;
   - `BankProviderEdit.jsx` uses `useAccountEditPage` with `base: PROVIDERS_BASE`. The
     heading is "Rename …" when archived.

Specs cover the fields module (defaults, every 400 mirror, the yearly ↔ monthly switch,
partial-diff PATCH), the controllers' client calls, the helper's labels and conditional due
month, and both pages in both contexts.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/pages/controllers/providerFormFields.js` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/controllers/BankProviderFormController.js`, `BankProviderNewController.js`, `BankProviderEditController.js` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderFormHelper.jsx` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/BankProviderNew.jsx`, `BankProviderEdit.jsx` (new)
- `frontend/assets/js/components/helpers/AppHelper.jsx` — wire `bank-provider-new`, `bank-provider-edit`
- `frontend/specs/assets/js/components/resources/bank/providers/pages/controllers/*Spec.js`, `frontend/specs/assets/js/components/resources/bank/providers/pages/helpers/BankProviderFormHelperSpec.js`, `frontend/specs/assets/js/components/resources/bank/providers/pages/BankProviderFormPagesSpec.js` (new)
