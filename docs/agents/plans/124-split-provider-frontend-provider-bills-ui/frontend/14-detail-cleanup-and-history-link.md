# Drop provider Bill history, add History links

Remove `renderAfterLedger` (the `<BillHistory sourceType="provider_expense">` block) from
`BankProviderDetailHelper`. The account-level `bill-payments.json` route is only a
transition alias, and it becomes debt-only in #125. Debt detail keeps its block.

Add a **History** link to every row in the Bills block, one-offs included. It points to
`bills/:billId/history`, built context-aware. Hide it on archived providers (see Notes in
frontend.md).

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx`:
  drop `renderAfterLedger`.
- `frontend/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx`:
  History link per row.
- Specs:
  - `BankProviderDetailHelperSpec` / `BankProviderDetailSpec`: no Bill history on the provider
    detail;
  - the Bills block spec: a History link on each row, with the correct href in both contexts.
