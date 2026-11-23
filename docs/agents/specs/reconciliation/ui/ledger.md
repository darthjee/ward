# Reconciliation — Ledger, header and history UI

Part of the [Reconciliation spec](../README.md). This file defines what the normal ledger, the
account header and the statements history show. Paths are under
`frontend/assets/js/components/resources/bank/common/` (written `B/` below), shared by all four
account types.

## Cleared marker

A "✓ cleared" marker on rows with `reconciliation.status === 'finished'`, with a tooltip showing
the statement date formatted in the display locale. It is rendered through `renderRowExtra` or a
dedicated cell.

## Locked fields

For a cleared row, the inline form in `B/detail/helpers/LedgerFormHelper.jsx` and
`ledgerFormFields.js` renders `amount` and `date` read-only, and `renderDelete` in
`LedgerTableHelper` returns null. The server's 409 stays the backstop.

## Warning badge

On an uncleared row dated on or before `last_reconciled_date`: "Not on reconciled statement of
<date>".

The badge is derived in the frontend, by comparing each row against the ledger envelope's
`last_reconciled_date`: `reconciliation === null && date <= last_reconciled_date`. It costs one
envelope query per page and no per-row query (see
[api/existing-routes.md](../api/existing-routes.md#transactions)).

## Header line

"Last reconciled: <date> · <balance>" under the `Balance:` line in `AccountHeaderHelper`, from
`last_reconciliation` of the account detail. On a debt the balance is shown negated.

The account edit form shows the opening fields read-only when `last_reconciliation` or
`open_reconciliation_id` is set (read from the account detail, which is the only payload that
carries them), with a hint to cancel or undo the statements first.

## Statements history

A section rendered for every type from the shared `AccountDetailHelper` (not per section page).
It is modelled on Bill history (`B/bills/BillHistory.jsx`, `hooks/useBillHistory.js`,
`controllers/BillHistoryController.js`, `helpers/BillHistoryHelper.jsx`, `B/BankPagination.jsx`):
date, balance, `reconciled_at` and row count, newest first, paginated in component state.
**Undo** appears only where `undoable` and `useCan(ACTIONS.UNDO_RECONCILIATION)` (`admin`), behind a confirmation modal like
`B/bills/UndoPaymentConfirm.jsx`. Drilling from a statement to a filtered ledger is out of scope
(see [Future epics](../README.md#future-epics)).

## Errors

Errors go through `B/BankErrorAlert.jsx` and `B/bankErrors.js` `classifyError`, with a new code
to message `Map` for `RECONCILIATION_UNBALANCED`, `RECONCILIATION_OPEN`,
`RECONCILIATION_OUT_OF_ORDER`, `RECONCILIATION_NOT_LATEST`, `RECONCILIATION_FINISHED`,
`TRANSACTION_NOT_ELIGIBLE`, `TRANSACTION_CLEARED` and `ACCOUNT_RECONCILED`. There is no central
code map today, so this one lives next to the reconciliation controller. The codes are defined in
[api/reconciliations.md](../api/reconciliations.md#error-codes).

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Bank — UI](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/ui.md)
- [`LedgerFormHelper.jsx`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerFormHelper.jsx)
- [`BillHistory.jsx`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/components/resources/bank/common/bills/BillHistory.jsx)
- [`UndoPaymentConfirm.jsx`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/components/resources/bank/common/bills/UndoPaymentConfirm.jsx)
- [`bankErrors.js`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/components/resources/bank/common/bankErrors.js)

## Required tests

Jasmine specs mirroring the source paths under `frontend/specs/assets/js/...`. The frontend
uses Jasmine only: no end-to-end tooling is added for this epic.

- **Cleared marker**: shown for `status === 'finished'` with the statement date in the tooltip,
  and not shown for rows of an open statement.
- **Locked fields**: `amount` and `date` read-only on a cleared row, the other fields still
  editable, and `renderDelete` returns null.
- **Warning badge**: shown on an uncleared row dated on or before `last_reconciled_date`; a row
  dated exactly on it shows the badge and a later row does not; no badge when
  `last_reconciled_date` is null; cleared rows never show it.
- **Header line**: shown from `last_reconciliation` and absent when it is null; the debt negation;
  it refreshes after a finish and after an undo.
- **Account edit form**: the opening fields are read-only, with the hint, when
  `last_reconciliation` or `open_reconciliation_id` is set, and editable when neither is.
- **History section**: rows (date, balance, `reconciled_at`, count) newest first, the open
  statement on top, pagination, and rendered for all four account types from `AccountDetailHelper`
  (mirroring `BillHistorySpec`, `useBillHistorySpec`, `BillHistoryControllerSpec` and
  `BillHistoryHelperSpec`).
- **History Undo**: hidden for `user` and when `undoable` is false even for `admin`, shown for
  `admin` and `owner` (the personal context counts as `owner`); the confirmation comes first and
  dismissing it sends no request; after a successful undo the history, the ledger (rows
  unlocked) and the header line refresh.
- **Error messages**: one test per new code in the `classifyError` map (`RECONCILIATION_UNBALANCED`,
  `RECONCILIATION_OPEN`, `RECONCILIATION_OUT_OF_ORDER`, `RECONCILIATION_NOT_LATEST`,
  `RECONCILIATION_FINISHED`, `TRANSACTION_NOT_ELIGIBLE`, `TRANSACTION_CLEARED`,
  `ACCOUNT_RECONCILED`), the rendering through `BankErrorAlert`, and an unmapped code (such as
  `RECONCILIATION_NOT_FINISHED`, which Undo's visibility rule makes unreachable from the UI)
  falling back to the server message.

Back to the [README](../README.md).
