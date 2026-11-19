# Bills block component

Add a self-loading **Bills** block for the provider detail. Follow the `BillHistory` pattern:

- The page lives in component state, because the ledger owns `?page`.
- Load through `runLoad` / `buildLoadEffect`.
- Paginate with `BankPagination` using `hrefFor={() => state.selfHref}` and `onNavigate`.
- Render nothing while loading or on error.

There is one row per bill:

- Description.
- Kind badge (recurring / one-off). Put it in a small `BillKindBadge` so the history page in
  step 13 can reuse it.
- Expected amount with frequency for recurring bills, via `formatExpected`. A null amount shows
  `—`.
- Due day, plus due month for yearly bills. One-offs show the due date instead.

Bills show in API order. Actions:

- **Add bill:** reuse `AddBillLink`, which links to `bills/new?provider=:id`.
- **Edit:** links to `bills/:billId/edit`.
- **Delete:** asks for confirmation in `ConfirmModal`, calls `deleteProviderBill`, then reloads.

When the provider is archived, hide Add, Edit and Delete (see Notes in frontend.md).

Delete error mapping, in the controller:

- `PROVIDER_BILL_PAID` on a recurring bill shows "This bill has payments and can't be deleted.
  Untick 'Show in calendar' to stop it."
- `PROVIDER_BILL_PAID` on a one-off shows the existing paid-bill message (`BILL_PAID_MESSAGE`).
- 404 and other errors are handled like other bank lists do: classify with
  `classifyError`, otherwise show the server message.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/common/ProviderBills.jsx`: new
  component.
- `frontend/assets/js/components/resources/bank/providers/common/controllers/ProviderBillsController.js`:
  new. Handles load page, delete and error mapping.
- `frontend/assets/js/components/resources/bank/providers/common/hooks/useProviderBills.js`: new.
- `frontend/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx`:
  new. Renders the rows, actions, pagination and modal.
- `frontend/assets/js/components/resources/bank/common/bills/BillKindBadge.jsx`: new.
- Matching specs under
  `frontend/specs/assets/js/components/resources/bank/providers/common/` and
  `.../bank/common/bills/`. Cover:
  - row rendering per kind;
  - pagination;
  - actions hidden when the provider is archived;
  - Delete confirm and reload;
  - the `PROVIDER_BILL_PAID` message for each kind.
