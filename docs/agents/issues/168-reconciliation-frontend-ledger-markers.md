# Issue: Reconciliation — frontend: ledger markers

## Description

Part of epic #85 (Reconciliation: statement checkpoints). This issue adds the ledger markers in the frontend: the cleared marker, the locked fields on cleared rows, the warning badge, the header line, and the read-only opening fields on the account edit form. It covers all four account types (accounts, debts, investments, providers) through the shared code in `frontend/assets/js/components/resources/bank/common/`.

**Owner:** `frontend`. **Depends on:** #166 (locks on existing routes), merged. **Parallel with:** #167, merged, which already added reconcile mode, the Statements history and the `classifyError` codes.

## Source of truth

The finished specs in [`docs/agents/specs/reconciliation/`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/README.md). Read these files:

- [`api/existing-routes.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/api/existing-routes.md): the `reconciliation` ledger field, `last_reconciled_date`, `last_reconciliation` and `open_reconciliation_id`.
- [`ui/ledger.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/ui/ledger.md): § Cleared marker, § Locked fields, § Warning badge and § Header line (§ Statements history and § Errors belong to #167).

## Required tests

This issue must satisfy these bullets of `ui/ledger.md` § Required tests: **Cleared marker**, **Locked fields**, **Warning badge**, **Header line** and **Account edit form**. On top of the spec, the edit form specs also assert that the currency is locked when `last_reconciliation` or `open_reconciliation_id` is set on an account with no transactions.

`ui/ledger.md` is split with #167: the History section, History Undo and Error messages bullets belong to #167. Neither issue claims the other's tests.

## Problem

Once rows can be cleared, the ledger must show which ones are protected, which ones may be suspicious, and what the last statement was.

## Expected Behavior

- A cleared marker on rows of a finished statement, with the statement date in the tooltip, and none for rows of an open statement.
- `amount` and `date` read-only on a cleared row, the other fields still editable, and the delete action hidden.
- The warning badge on an uncleared row dated on or before `last_reconciled_date` (never on cleared rows, none when the date is null).
- The header line from `last_reconciliation`, with the debt negation, refreshing after a finish and after an undo.
- The opening fields of the account edit form read-only, with the hint, when `last_reconciliation` or `open_reconciliation_id` is set. Under the same condition, the currency is locked too, even when the account has no transactions.

## Solution

Follow the specs, using Jasmine specs mirroring the source paths under `frontend/specs/assets/js/...`. Run the frontend checks through `docker-compose run`.

Implementation notes from the codebase as it is after #167:

- **Cleared marker and warning badge.** Render them as a small inline badge inside an existing cell of the row (for example next to the description), with no new column, from the shared `LedgerTableHelper.jsx`, not through `renderRowExtra`. The providers section already uses `renderRowExtra` for the accountant hand-off (`BankProviderDetailHelper.jsx`), and the marker must appear for all four types.
- **Header line refresh.** After a finish (`useReconcile`) or an undo (`AccountDetailHelper`), the page already reloads the account and the ledger. A header line derived from the reloaded account detail refreshes with no extra wiring. The tests assert this.
- **Account edit form.** `common/form/hooks/useAccountEditPage.js` is shared by all four edit pages and already loads the account detail. Derive the opening lock there, next to the existing `currencyLocked`, and pass it to `AccountFormHelper.jsx`. Lock the currency under the same condition too: `currencyLocked` becomes "has transactions **or** `last_reconciliation` / `open_reconciliation_id` is set", because the server answers 409 `CURRENCY_LOCKED` once any statement exists, even a zero-row one. The debt form (`BankDebtFormHelper.jsx`, `debtFormFields.js`) shows the opening balance negated and must respect the same lock.

## Benefits

- Users see which rows are protected and where a backfilled row may break a statement.
