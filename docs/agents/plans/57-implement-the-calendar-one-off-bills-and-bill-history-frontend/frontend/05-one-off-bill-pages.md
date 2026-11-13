# One-off bill pages

Pages `<ui>/bills/new` and `<ui>/bills/:id/edit`, in a new
`components/resources/bank/bills/` section.

- `pages/BankBillNew.jsx`, `pages/BankBillEdit.jsx` — the edit page reads `:billId` with
  `Router.extractContextParams('/bank/bills/:billId/edit', currentHash())` and loads the bill
  (`404` → not-found state).
- `pages/controllers/billFormFields.js` — empty / from bill / validate: provider, paying account
  and due date required (past dates allowed), amount via `parseAmount(input, { currency })`
  with the provider's currency (> 0, right decimals, 10^13 bound), description trimmed and
  required (≤ 255), notes optional (≤ 2000, blank → null). Paying account is required on both
  create and edit.
- `pages/controllers/BillFormController.js` — create / update (send only changed fields on edit)
  / delete; 422 and 409 `BILL_PAID` go to the form alert via `classifyError` (the 409 message
  tells the user to undo the payment first). After save, delete or cancel, navigate to the
  provider's detail page (`<ui>/providers/:providerId`); cancel on a new bill with no provider
  goes to the providers list.
- `pages/hooks/useBillForm.js` — loads providers (`listAccounts({ type: 'provider_expense' })`,
  non-archived) and regular accounts (`listAccounts({ type: 'regular' })`); pre-selects
  `?provider=:id` (`hashQuery(currentHash()).get('provider')`) on the new page; filters the
  paying-account options by the selected provider's currency, recomputed when the provider
  changes, clearing a now-mismatching paying account.
- `pages/helpers/BankBillFormHelper.jsx` — the form (provider select, paying-account select, due
  date, amount, description, notes), `BankErrorAlert`, and on edit a **Delete** button with
  `ConfirmModal`.
- Add `BILLS_BASE = '/bank/bills'` to `bank/common/sections.js`.

Specs (Add / edit bill required tests): required fields and limits; paying-account select
filtered by the provider's currency and refreshed on provider change; provider pre-selected from
`?provider=`; 422 shown on the form; delete asks for confirmation; delete of a paid bill shows the
"undo the payment first" message; links built from the active context (`/bank` and
`/orgs/5/bank`); escaped description / notes / names.

## Files to Change
- `frontend/assets/js/components/resources/bank/bills/pages/BankBillNew.jsx` — new
- `frontend/assets/js/components/resources/bank/bills/pages/BankBillEdit.jsx` — new
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/billFormFields.js` — new
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/BillFormController.js` — new
- `frontend/assets/js/components/resources/bank/bills/pages/hooks/useBillForm.js` — new
- `frontend/assets/js/components/resources/bank/bills/pages/helpers/BankBillFormHelper.jsx` — new
- `frontend/assets/js/components/resources/bank/common/sections.js` — `BILLS_BASE`
- `frontend/specs/assets/js/components/resources/bank/bills/...` — specs for the new files
