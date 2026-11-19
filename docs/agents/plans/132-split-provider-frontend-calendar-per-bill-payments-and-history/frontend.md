# Frontend Plan: Split provider — frontend: calendar, per-bill payments and history

Main plan: [plan.md](plan.md)

## Shared contracts

- **Relies on**: `GET <base>/provider-bills/:id.json` answering `200` for an archived-provider
  bill (backend step). `GET <base>/accounts/:id.json` and
  `GET <base>/provider-bills/:id/bill-payments.json` already work on archived providers.
- Archived check: truthy `account.archived_at`.

## Implementation Steps

### Step 1 — Always render the History link in the Bills block

In `frontend/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx`:

- `renderActions` (lines 40-57): drop the early `return null` for `state.account.archived_at`.
  Always return the `<td className="text-end text-nowrap">` with the History link.
- Move Edit (`<a href={editHref}>`) and Delete (`<button>`, which calls `handlers.onDelete(bill)`)
  into a private helper, e.g. `renderEditDelete(bill, state, handlers)`. The helper returns
  `null` when `state.account.archived_at` is set.
- Update the JSDoc (lines 32-39):
  - History is always rendered, and Edit/Delete are hidden on an archived provider.
  - The return type becomes `React.ReactElement`.
- `renderBody`, line 103: render `<th aria-label="Actions" />` unconditionally so the header
  matches the cell.
- Leave `AddBillLink` (hidden on archived providers) unchanged.

In `frontend/specs/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelperSpec.js`:

- Update the test "hides Add, Edit and Delete on an archived provider":
  - `contains('/history')` and `containsAttribute('href', '#/bank/bills/4/history')` become true.
  - `/edit`, `>Delete<` and `Add bill` stay absent.
- Add an archived case for a one-off bill as well, if the fixtures allow it (the issue requires
  "one-offs included").
- Add assertions that the `aria-label="Actions"` header is present on both archived and active
  providers.
- Make sure there is an active-provider test asserting that History, Edit and Delete are all
  present (existing tests may already cover this; extend them if not).

### Step 2 — Align the history page comments and the UI spec

- `frontend/assets/js/components/resources/bank/bills/pages/BankBillHistory.jsx` (lines 7-8) and
  `frontend/assets/js/components/resources/bank/bills/pages/controllers/billHistoryPageLoad.js`
  (lines 31-33): the comments claim that a bill of an archived provider shows Not-found. Change
  them to say only an unknown (or foreign) bill shows Not-found, and that an archived provider's
  bill renders read-only (payments listed, Undo hidden by `BillHistoryHelper`). No logic change is
  expected. Check that the existing page/loader specs don't assert Not-found for archived
  providers, and update them if they do.
- `docs/agents/specs/split-provider/ui/provider-bills.md`, § "Provider detail — Bills block": add
  that on an archived provider, **Add bill**, **Edit** and **Delete** are hidden, and that each
  row (one-offs included) keeps its **History** link, which opens the read-only per-bill history.

## Files to Change

- `frontend/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx`:
  History always visible, Edit/Delete conditional, header always rendered, JSDoc.
- `frontend/specs/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelperSpec.js`:
  archived and active action/header assertions.
- `frontend/assets/js/components/resources/bank/bills/pages/BankBillHistory.jsx`: doc comment.
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/billHistoryPageLoad.js`:
  doc comment.
- `docs/agents/specs/split-provider/ui/provider-bills.md`: archived-provider actions rule.

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn test` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Undo is already hidden on archived providers by `BillHistoryHelper.jsx` (`renderUndo`, lines
  27-28, plus header line 72). No change is needed there.
- The History link only works end to end once the backend GET change has landed.
