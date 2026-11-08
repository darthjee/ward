# Debts list page

New `components/resources/bank/debts/pages/BankDebtList.jsx` (+ loader / helper), mirroring
`BankAccountList` but calling the debt list (`type=debt`):

- Columns: name, creditor (`bank_name`), current balance, instalment amount with frequency
  ("500,00 / month" / "/ year"; empty when unset), interest rate with period
  ("1.99% / month"; empty when unset), currency. Amounts via `formatMoney` in the account's own
  currency. **No grand total.**
- Sorted by name (as the API returns; sort defensively if the Accounts list does); no pagination.
- *Show archived* toggle (archived rows marked); **New debt** button → `<ui>/debts/new`.
- Empty state "No debts yet" with a create button.
- A row opens `<ui>/debts/:id`; all links built with `contextHash` from the active context.
- Reuse whatever list plumbing #49 has (loader, toggle) — parameterise rather than copy if
  needed. Add a small rate formatter (e.g. in `bank/common/`) for "rate% / period".

Specs: columns and formatting, no total, sorting, archived toggle, New debt, empty state, row
link, both contexts, name / creditor rendered escaped.

## Files to Change
- `components/resources/bank/debts/pages/BankDebtList.jsx` — new
- `components/resources/bank/debts/pages/controllers/BankDebtsLoader.js` — new (or shared loader parameterised by type)
- `components/resources/bank/debts/pages/helpers/BankDebtListHelper.jsx` — new (`LIST_PATH='/bank/debts'`)
- `components/resources/bank/common/rates.js` (or similar) — rate / frequency labels
- Specs mirroring the above under `frontend/specs/assets/js/components/resources/bank/…`
