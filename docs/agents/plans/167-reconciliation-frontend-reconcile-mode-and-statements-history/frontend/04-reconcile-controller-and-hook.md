# Reconcile controller and hook

**`B/reconciliation/controllers/eligibility.js`**, pure functions:

- `isEligible(row, { account, statement })` follows the rule in [frontend.md](../frontend.md).
  The opening row is never eligible.
- `isTicked(row, { statement, ticked })`.
- `eligibleIds(rows, ctx)`.
- `visibleRows(rows, ctx, onlyUncleared)` is the local "Show only uncleared" filter. It drops rows
  where `row.reconciliation` is set and not part of the open statement, and rows that are ticked.
  It makes no request.

**`B/reconciliation/controllers/ReconcileController.js`** is a class with constructor DI
`{ context, accountId, account, setReconcile, reload, client = BankClient }`. All errors go
through `classifyReconciliationError`. A `sessionExpired` error does nothing, as in
`BillHistoryController`. Methods:

- `open()`: with no `open_reconciliation_id`, switch to the start form. Otherwise
  `getReconciliation`, then `active`.
- `openEdit()` and `closeForm()`.
- `submitForm(fields)`: validate with `statementFields`, then call `startReconciliation` or
  `updateReconciliation`. On success, store `statement`, go to `active`, and call `reload()` after
  a start so the header picks up `open_reconciliation_id`. On error, keep the form and show the
  message (for example `RECONCILIATION_OUT_OF_ORDER` or `RECONCILIATION_FINISHED`).
- `toggle(row)`: optimistic.
  1. Record the previous `ticked` entry and `statement`.
  2. Flip `ticked` for the row.
  3. Send `tickTransactions({ tick: [id] })` or `({ untick: [id] })`.
  4. On success, set `statement` from the response (the new difference).
  5. On error, restore both the checkbox and the previous statement, and set the error.
- `tickAll(rows)` and `untickAll(rows)`: one `tickTransactions` call with the eligible ids of the
  page that are unticked (for tick all) or ticked (for untick all). An empty set sends nothing.
  Apply the same optimistic overlay and revert as `toggle`.
- `toggleOnlyUncleared()`: local only.
- `finish()`: `finishReconciliation`. On success, reset to `off`, clear the overlay, `reload()` and
  bump `historyVersion`. On `RECONCILIATION_UNBALANCED`, show the message.
- `requestCancel()`, `dismissCancel()` and `confirmCancel()`. Confirming sends
  `cancelReconciliation`. On success it resets to `off`, then `reload()` and bumps
  `historyVersion`. A 403 shows the permission message.
- `onLedgerReloaded()`: clears the `ticked` overlay.

**`B/reconciliation/hooks/useReconcile.js`** is `useReconcile({ context, account, reload })`.

- It holds the reconcile state with `useState`, builds the controller in `useMemo`, and gets
  `canWrite = useCan(ACTIONS.WRITE)` and `canCancel = useCan(ACTIONS.DELETE)`.
- It exports `buildReconcileHandlers(controller)`, like `buildBillHistoryHandlers`. The handlers
  are `onReconcile`, `onEditStatement`, `onCloseForm`, `onFieldChange`, `onSubmitStatement`,
  `onToggle`, `onTickAll`, `onUntickAll`, `onToggleOnlyUncleared`, `onFinish`, `onCancel`,
  `onConfirmCancel`, `onDismissCancel` and `onDismissError`.
- It returns `{ reconcile, reconcileHandlers }`.

`useAccountDetail.js` calls it and exposes `state.reconcile` and `handlers.reconcile`. When the
loaded ledger changes, it calls `onLedgerReloaded`. `useAccountDetail.js` is 106 lines, so add as
little to it as possible.

Specs mirror `BillHistoryControllerSpec` and `useBillHistorySpec`. They use fake client spies,
`ApiError` and `sessionExpiredError`. Cover:

- the start and edit bodies;
- the 409 messages (`RECONCILIATION_OUT_OF_ORDER`, `RECONCILIATION_FINISHED`,
  `TRANSACTION_NOT_ELIGIBLE` and `RECONCILIATION_UNBALANCED`);
- the optimistic tick and untick, the `{ tick: [id] }` and `{ untick: [id] }` bodies, and the
  difference taken from the response;
- the revert of both the checkbox and the difference on error;
- bulk ticks: one call, never per-row calls, and an empty set sends nothing;
- Show only uncleared makes no request;
- Finish leaves the mode and reloads;
- Cancel: dismissing sends nothing, confirming sends the DELETE and leaves the mode, and a 403
  shows the permission message;
- the eligibility window: dates on the edges, before `opening_date`, after `statement_date`, a row
  cleared by an earlier statement, and the opening row.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/reconciliation/controllers/eligibility.js` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/controllers/ReconcileController.js` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/hooks/useReconcile.js` — new.
- `frontend/assets/js/components/resources/bank/common/detail/hooks/useAccountDetail.js` — call `useReconcile`, expose its state and handlers.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/controllers/eligibilitySpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/controllers/ReconcileControllerSpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/hooks/useReconcileSpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/detail/hooks/useAccountDetailSpec.js` — the reconcile state and handlers are exposed, with `canWrite` and `canCancel` per role.
