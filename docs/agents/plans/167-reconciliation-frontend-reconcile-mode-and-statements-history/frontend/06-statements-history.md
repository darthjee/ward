# Statements history with Undo

Mirror the Bill history stack, one file per role:

- **`B/reconciliation/StatementsHistory.jsx`** takes `{ context, account, historyVersion, onUndone }`.
  - It calls `useStatementsHistory` and `useCan(ACTIONS.UNDO_RECONCILIATION)`.
  - It renders `StatementsHistoryHelper.render({ ...state, account, canUndo }, handlers)`.
- **`B/reconciliation/hooks/useStatementsHistory.js`** follows `useBillHistory`.
  - It keeps the page in component state, with `data`, `error`, `pending`, `confirmation` and
    `attempt`.
  - The controller is built in `useMemo`, with `onUndone` held in a ref.
  - The load effect is `buildLoadEffect`, with deps `[page, attempt, historyVersion]`.
  - It exports `buildStatementsHistoryHandlers`: `onNavigate`, `onUndo`, `onConfirmUndo`,
    `onCancelUndo`, `onRetry` and `onDismiss`.
- **`B/reconciliation/controllers/StatementsHistoryController.js`** follows
  `BillHistoryController`.
  - It exports `EMPTY_HISTORY` (`{ reconciliations: [], pagination: {...} }`).
  - `load(page, isActive)` calls `listReconciliations`.
  - `undo(row)` calls `undoReconciliation` and then `refresh()`, which reloads the history and
    calls `onUndone`.
  - Errors go through `classifyReconciliationError` (for example `RECONCILIATION_NOT_LATEST` and
    `RECONCILIATION_OPEN`). A 404 is re-labelled as a conflict, then the history refreshes.
- **`B/reconciliation/helpers/StatementsHistoryHelper.jsx`** follows `BillHistoryHelper`.
  - It renders `<section className="mt-4" aria-label="Statements history">` with an h2.h4.
  - It shows the `BankErrorAlert`, then "Loading…" or the empty text
    (`EMPTY_STATEMENTS_TEXT`), then a table.
  - The table columns are statement date, statement balance (debt negated), `reconciled_at`
    ("Open" when null), row count and actions.
  - Rows keep the server order: newest first, with the open statement on top.
  - It renders `BankPagination` with `hrefFor={() => state.selfHref}`.
  - **Undo** is shown only when `row.undoable && state.canUndo`.
- **`B/reconciliation/UndoReconciliationConfirm.jsx`** is a thin `ConfirmModal` wrapper (title
  "Undo reconciliation", confirmLabel "Undo"), like `UndoPaymentConfirm`.

**Wiring.** `AccountDetailHelper.renderLoaded` renders `<StatementsHistory>` after the
`renderAfterLedger` slot, for all four types. It passes `historyVersion` from `state.reconcile` and
an `onUndone` that calls `handlers.onRetryLoad` (reload the account and the ledger, which unlocks
the rows and refreshes the header) and resets the reconcile mode.

Specs mirror `BillHistorySpec`, `useBillHistorySpec`, `BillHistoryControllerSpec`,
`BillHistoryHelperSpec` and `UndoPaymentConfirmSpec`. Cover:

- the rows (date, balance, `reconciled_at`, count), newest first, with the open statement on top;
- pagination;
- a reload when `historyVersion` changes;
- Undo hidden for `user`, and hidden when `undoable` is false even for `admin`;
- Undo shown for `admin`, `owner` and the personal context;
- the confirmation comes first, and dismissing it sends no request;
- after a successful undo the history reloads and `onUndone` fires;
- the error messages.

`AccountDetailHelperSpec` checks that the section is rendered for each of the four section bases
(`ACCOUNTS_BASE`, `DEBTS_BASE`, `INVESTMENTS_BASE` and `PROVIDERS_BASE`).

## Files to Change
- `frontend/assets/js/components/resources/bank/common/reconciliation/StatementsHistory.jsx` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/UndoReconciliationConfirm.jsx` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/hooks/useStatementsHistory.js` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/controllers/StatementsHistoryController.js` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/helpers/StatementsHistoryHelper.jsx` — new.
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx` — render `StatementsHistory`.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/StatementsHistorySpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/UndoReconciliationConfirmSpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/hooks/useStatementsHistorySpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/controllers/StatementsHistoryControllerSpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/helpers/StatementsHistoryHelperSpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelperSpec.js` — the section is rendered for all four types.
