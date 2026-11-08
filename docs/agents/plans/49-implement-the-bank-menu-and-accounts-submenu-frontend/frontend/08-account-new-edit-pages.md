# Account new and edit pages

`BankAccountNew.jsx` (`bank-account-new`) and `BankAccountEdit.jsx` (`bank-account-edit`), sharing
a form helper and a base form controller (as `OrganizationFormController` /
`OrganizationNewController` / `OrganizationEditController` do).

**Form** (`BankAccountFormHelper.jsx`): name, bank name, branch, account number, `CurrencySelect`,
opening date (`<input type="date" max={localToday()}>`, default local today), opening balance
(single field, optional leading `-`, default `0`), notes. Field errors via `FormFieldsHelper`
conventions; Save disabled while pending.

**Controller** (`BankAccountFormController` base): client checks (name required; opening date
not after local today; `parseAmount(opening_balance, { currency, allowNegative: true,
allowZero: true })`) → `setPending(true)` → request → navigate to the detail page
(`contextHash(context, '/bank/accounts/:id')`; never display the masked write response).
Errors through `classifyError`:
- 400 → details (or message) under the form, values kept;
- 409 `ACCOUNT_NAME_TAKEN` → field error on `name`, values kept, no reload;
- 409 `CURRENCY_LOCKED` / `ACCOUNT_ARCHIVED` (edit) → message in an inline alert, then reload the
  account and the ledger page 1 so the form re-renders locked / name-only;
- 404 → NotFound; network / 5xx → `BankErrorAlert` with Retry (resubmit).

**New**: loads `BankClient.getSettings(context)` for the default currency. On failure the form
still works — no default, currency required, small warning.

**Edit**: loads `getAccount` (full account number) and `listTransactions(context, id, 1)`;
`pagination.total_count > 0` → currency locked. When the account is **archived**, only `name` is
editable and the PATCH body contains **only `name`** (any other present field gives 409
`ACCOUNT_ARCHIVED`). Otherwise send the changed fields (never a different currency while locked).
Archive / Unarchive and Delete live on the detail page (step 09), not here.

Register both pages in `AppHelper`. Read `:accountId` with
`Router.extractContextParams('/bank/accounts/:accountId/edit', window.location.hash)`.

Specs: `regular.md` *Frontend* create / edit items; default currency from settings and the
settings-failure fallback; currency locked from `total_count`; archived → name-only body; each
error branch above; double-submit disabling; both contexts.

## Files to Change
- `frontend/assets/js/components/resources/bank/accounts/pages/BankAccountNew.jsx` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/BankAccountEdit.jsx` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/BankAccountFormController.js` — new (base)
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/BankAccountNewController.js` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/BankAccountEditController.js` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/BankAccountLoader.js` — new (account + ledger page 1, settings; `build...LoadEffect`)
- `frontend/assets/js/components/resources/bank/accounts/pages/helpers/BankAccountFormHelper.jsx` — new
- `frontend/assets/js/components/helpers/AppHelper.jsx` — register `bank-account-new`, `bank-account-edit`
- `frontend/specs/assets/js/components/resources/bank/accounts/pages/` — page, controller, loader and helper specs mirroring the above
