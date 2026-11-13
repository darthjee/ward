# Shared Undo confirmation and Bill history

**Shared Undo confirmation** (reused by the Calendar in #77):
`components/resources/bank/common/bills/UndoPaymentConfirm.jsx`, wrapping `ConfirmModal`.
Props: `show`, `showChargeWarning`, `pending`, `onConfirm`, `onCancel`. The body says undoing
deletes the transactions the payment created; when `showChargeWarning` is set it adds that this
includes a charge already sent to the accountant. Confirm label: "Undo". Export a pure helper
`undoWarnsCharge({ status, sourceType, isOneOff })` → true for paid provider rows and paid
one-off rows, false for debt rows and skipped rows.

**Bill history** on the debt and provider detail pages:

- `components/resources/bank/common/bills/BillHistory.jsx` — takes `{ context, account,
  sourceType }`, owns its hook.
- `components/resources/bank/common/bills/hooks/useBillHistory.js` plus
  `controllers/BillHistoryController.js` — load a page via `BillsClient.listBillPayments`; page
  kept in component state (not the hash, to avoid clashing with the ledger's `?page`); undo with
  a pending flag: derived rows (`bill === null`) call `undoOccurrencePayment(context,
  account.id, row.due_date)`, one-off rows call `undoBillPayment(context, row.bill.id)`; on
  success reload; on 404 / 409 reload and set the error (classified by `classifyError`).
- `components/resources/bank/common/bills/helpers/BillHistoryHelper.jsx` — table with status
  (Paid / Skipped), due date, paid-on, amount (`formatMoney(amount, account.currency)`), paying
  account name, the one-off bill's description, an **Off-schedule** badge when `off_schedule`,
  an **Undo** button per row hidden while `account.archived_at` is set, `BankErrorAlert`, an
  empty state, and `BankPagination` (`onNavigate` prevents default and sets the page).
- `common/detail/helpers/AccountDetailHelper.jsx` — add an optional `renderAfterLedger(account,
  handlers, state)` slot; `BankDebtDetailHelper.jsx` and `BankProviderDetailHelper.jsx` use it
  to render `<BillHistory>` (sourceType `debt` / `provider_expense`).

Specs: lists paid and skipped rows newest first as returned; off-schedule marked; one-off
description shown; Undo calls the derived vs one-off route after confirmation and reloads; Undo
hidden on archived accounts; sent-charge warning only for paid provider / one-off rows; 404 / 409
reloads and shows the alert; pagination loads the next page; escaped names / descriptions.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/bills/UndoPaymentConfirm.jsx` — new
- `frontend/assets/js/components/resources/bank/common/bills/BillHistory.jsx` — new
- `frontend/assets/js/components/resources/bank/common/bills/hooks/useBillHistory.js` — new
- `frontend/assets/js/components/resources/bank/common/bills/controllers/BillHistoryController.js` — new
- `frontend/assets/js/components/resources/bank/common/bills/helpers/BillHistoryHelper.jsx` — new
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx` — `renderAfterLedger` slot
- `frontend/assets/js/components/resources/bank/debts/pages/helpers/BankDebtDetailHelper.jsx` — render Bill history
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx` — render Bill history
- `frontend/specs/assets/js/components/resources/bank/common/bills/...` — specs for the new files
- `frontend/specs/assets/js/components/resources/bank/{debts,providers}/pages/helpers/*DetailHelperSpec.js` — extend
