# Debt create / edit pages

New `BankDebtNew.jsx` / `BankDebtEdit.jsx` with controllers extending the shared form
controller (base `'/bank/debts'`), using the shared common fields with label overrides and
extra debt fields:

- Labels: "Bank" → **Creditor**, opening date → **Loan date**, opening balance →
  **Amount owed**. `type` is not shown.
- **Amount owed negation**: typed positive → sent as negative `opening_balance`; typed negative
  → sent positive; a stored `-10000.00` is shown as `10000.00` (negate the decimal string both
  ways, `0` stays `0`). Validation still goes through `parseAmount` with negatives and zero
  allowed.
- Debt fields in `debtFormFields.js` (extending the common fields): interest rate (0–100, ≤ 4
  decimals); interest period (`monthly`|`yearly`) **shown only once a rate is entered** and then
  **required**; instalment amount (`parseAmount`, > 0, account currency); instalment frequency
  (default `monthly`); due day (1–31); due month (1–12, **shown only for `yearly`** and then
  required; not sent / sent `null` for `monthly`); instalment count (≥ 1 integer, empty =
  open-ended).
- **Clearing the rate**: emptying the rate hides the period and the request sends
  `interest_rate: null` and `interest_period: null` together.
- Create sends `type: "debt"` + `debt`; Edit sends only changed fields (`changedFields`) plus
  the changed `debt` keys (null to clear), never `type`. On an archived debt only the name is
  editable (shared `renderNameOnly`).
- After save, navigate to `<ui>/debts/:id`; error handling as Accounts (`classifyError`).

Specs: labels; negation both ways and display of stored balance; period appears only with a
rate and is required then; due month only for yearly; clearing the rate sends both nulls;
create body has `type: "debt"`; edit body has no `type`; `type` field absent; both contexts.

## Files to Change
- `components/resources/bank/debts/pages/BankDebtNew.jsx`, `BankDebtEdit.jsx` — new
- `components/resources/bank/debts/pages/controllers/BankDebtNewController.js`, `BankDebtEditController.js` — new, extend the shared base
- `components/resources/bank/debts/pages/controllers/debtFormFields.js` — new (debt fields, validation, negation, body building)
- `components/resources/bank/debts/pages/helpers/BankDebtFormHelper.jsx` — new (debt fields rendering on top of the shared form helper)
- Specs mirroring the above (e.g. `BankDebtFormPagesSpec.js`, `debtFormFieldsSpec.js`)
