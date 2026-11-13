# Schedule inputs on the Debts / Providers forms

Add **Bills from** (date), **Show in Calendar** (checkbox, on by default) and **Default paying
account** (optional select) to the create and edit forms of debts and providers.

- New shared `components/resources/bank/common/form/controllers/scheduleFields.js` (pure
  functions):
  - `emptyScheduleFields()` → `{ bills_from: '', show_in_calendar: true, paying_account_id: '' }`
  - `scheduleFieldsFromAccount(details)` → `bills_from ?? ''`, `show_in_calendar ?? true`,
    `String(paying_account?.id ?? '')` (the response has no raw id)
  - `validateScheduleFields(fields)` → `''` → `null` for `bills_from` / `paying_account_id`,
    id as `Number`, `show_in_calendar` as boolean
  - `withBillsFromAutofill(fields, name, value, today)` → when `name === 'due_day'`, the value is
    non-blank and `fields.bills_from === ''`, also set `bills_from` to `today`
    (`localToday()` from `bank/common/dates.js`)
  - `payingAccountOptions(accounts, currency)` → `[value, label]` pairs for regular accounts in
    that currency
- Wire them into `debtFormFields.js` and `providerFormFields.js` (field names, empty, from
  account, validate — nested under `debt` / `provider_expense`). `changedNestedFields` then
  diffs them on edit automatically, because the controller builds the original body from
  `validate(fieldsFrom(account))`.
- New `components/resources/bank/common/form/hooks/usePayingAccounts.js`: loads
  `BankClient.listAccounts(context, { type: 'regular' })` (non-archived by default) with
  `runLoad` / `buildLoadEffect`, returns the list; used by the four New / Edit pages, which pass
  `payingAccounts` into the helper state.
- New `components/resources/bank/common/form/helpers/ScheduleFieldsHelper.jsx`: renders the
  three inputs with `AccountFormInput` (`type: 'date'`), `AccountFormCheckbox` and
  `AccountFormSelect` (empty placeholder = no default). Rendered at the end of
  `renderDebtFields` / `renderProviderFields` in `BankDebtFormHelper.jsx` /
  `BankProviderFormHelper.jsx`. The due-day handler goes through `withBillsFromAutofill`.
- On the new pages, when the currency changes and the selected default paying account is not in
  the new currency, clear `paying_account_id`.
- Archived-account edit pages stay name-only — the inputs are not rendered there.

Specs: the three inputs render with the right defaults; Bills from autofills with today only on
the first due-day entry; the select lists only regular accounts in the account's currency; the
values are sent nested on create and only changed values on edit; the currency change clears a
mismatching default.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/form/controllers/scheduleFields.js` — new
- `frontend/assets/js/components/resources/bank/common/form/hooks/usePayingAccounts.js` — new
- `frontend/assets/js/components/resources/bank/common/form/helpers/ScheduleFieldsHelper.jsx` — new
- `frontend/assets/js/components/resources/bank/debts/pages/controllers/debtFormFields.js` — schedule fields
- `frontend/assets/js/components/resources/bank/providers/pages/controllers/providerFormFields.js` — schedule fields
- `frontend/assets/js/components/resources/bank/debts/pages/helpers/BankDebtFormHelper.jsx` — render inputs
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderFormHelper.jsx` — render inputs
- `frontend/assets/js/components/resources/bank/debts/pages/BankDebtNew.jsx`, `BankDebtEdit.jsx` — load paying accounts
- `frontend/assets/js/components/resources/bank/providers/pages/BankProviderNew.jsx`, `BankProviderEdit.jsx` — load paying accounts
- `frontend/specs/assets/js/components/resources/bank/common/form/...` — specs for the new files
- `frontend/specs/assets/js/components/resources/bank/{debts,providers}/pages/...` — extend form field, controller, helper and page specs
