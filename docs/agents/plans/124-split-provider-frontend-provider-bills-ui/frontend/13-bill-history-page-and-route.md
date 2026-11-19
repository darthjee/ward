# bank-bill-history page and route

Add the route `['/bank/bills/:billId/history', 'bank-bill-history']` to `ROUTES_CONTEXT` next
to the other `/bank/bills/...` rows. `SECTIONS_CONTEXT` doesn't change. Register the page in
`AppHelper.jsx`'s page map next to `bank-bill-new` and `bank-bill-edit`.

Create the page `BankBillHistory`:

**Load:**

- Load the bill with `ProviderBillsClient.getProviderBill(context, billId)`.
- Then load the provider with `BankClient.getAccount(context, bill.provider_account_id)`, for
  its name, currency and `archived_at`.
- A 404 from either call shows the uniform `NotFound` state.

**Render:**

- A back link `← <provider name>` to the provider detail, built context-aware.
- A header `<bill description> — <provider name>` with `BillKindBadge`. Recurring bills also
  show the expected amount with frequency (`formatExpected`).
- Body: `<BillHistory context=… account={provider} billId={bill.id}
  sourceType="provider_expense" />`. It shows paid and skipped payments, newest first,
  paginated, with Undo hidden while the provider is archived.

## Files to Change
- `frontend/assets/js/utils/routing/routes.js`: new route row.
- `frontend/assets/js/components/helpers/AppHelper.jsx`: register `bank-bill-history`.
- `frontend/assets/js/components/resources/bank/bills/pages/BankBillHistory.jsx`: new page.
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/billHistoryPageLoad.js`:
  new. Loads the bill, then the provider.
- `frontend/assets/js/components/resources/bank/bills/pages/hooks/useBillHistoryPage.js`: new.
- `frontend/assets/js/components/resources/bank/bills/pages/helpers/BankBillHistoryHelper.jsx`:
  new.
- Specs:
  - a `HashRouteResolverSpec.js` row for the new path, which the table resolves in both
    Personal and `/orgs/:id` contexts;
  - page and helper specs covering the back link, header (both kinds), list, Undo and
    not-found.
