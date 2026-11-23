# Issue: Reconciliation — backend: locks on existing routes

## Description

Part of epic #85 (Reconciliation: statement checkpoints). This issue applies the reconciliation locks to the **existing** bank routes: transaction create/edit/delete, ledger, account detail and edit, and the three bill-payment undo routes.

**Owner:** `backend`. **Depends on:** #164 (migration and entity, merged). **Builds on:** #165 (reconciliation API, merged). **Blocks:** #168 (frontend ledger markers). Needs a `security` review and a `cache` review when it finishes.

### Source of truth

The finished specs in [`docs/agents/specs/reconciliation/`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/README.md). Read these files:

- [`model.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/model.md): lock matrix, lifecycle, formulas, queries.
- [`api/existing-routes.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/api/existing-routes.md): the route changes and cache classes.
- [`security.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/security.md#concurrency): the common lock order and the concurrency outcomes.

### State after #165

#165 is merged, so this issue is the second of the pair and finishes the shared work:

- `transactionCleared()` and `accountReconciled()` in `backend/src/bank/reconciliation-conflicts.ts` exist but nothing calls them yet. This issue calls them. The deadlock mapper (`concurrentUpdate()` / `mapDeadlock()`) from #165 is reused, not re-implemented.
- Writes follow the lock order already used by `ReconciliationQuery` and the #165 writers: the account row, then the statement, then the transaction rows.
- The e2e specs can create, tick, finish, undo and cancel statements through the #165 routes, rather than seeding the rows directly.

## Problem

Cleared rows must not change after a statement is finished, and the opening anchor must not move once a statement exists. The existing routes do not know about statements yet, so today a finished statement can be broken by editing or deleting its rows, by moving the account anchor or currency, or by undoing a bill payment whose rows are cleared.

## Expected Behavior

- **Transactions:** the lock matrix of `model.md` is enforced. A cleared row answers `TRANSACTION_CLEARED` on a PATCH that changes `amount` / `date` and on DELETE, with no bypass for `admin`. The check order is 404, 400, `ACCOUNT_ARCHIVED`, the payment-generated 403, then `TRANSACTION_CLEARED`. A ticked row moved past `statementDate` or before `opening_date` is auto-unticked. Deleting a ticked row drops the tick. `reconciliation_id` / `reconciliation` in a body answer 400. `update()` and `delete()` lock the row inside a transaction, after the account lock.
- **Accounts:** the anchor lock (`ACCOUNT_RECONCILED`) on `opening_date` / `opening_balance`, and the currency lock (`CURRENCY_LOCKED`) while any statement exists, open or finished. This applies to the generic account and to the typed accounts (debt, provider-expense, investment). The account detail carries `last_reconciliation` and `open_reconciliation_id`, gated like `listExtras` so the list pays nothing. The account list does not carry them.
- **Ledger:** each row has a `reconciliation` field (`null` or `{ id, status, statement_date }`), computed with the account-scoped `LEFT JOIN`. The virtual opening row never carries it. The envelope has `last_reconciled_date`. Putting the join outside the window subquery is the recommended placement.
- **Bill payments:** the three payment undo routes (debt occurrence, one-off `bills/:id/payment`, provider-bill occurrence) are blocked in one place, `undoPayment()` / `BillPaymentWriter.remove()`. They answer `TRANSACTION_CLEARED` when any generated row is cleared, and drop the tick when a row is only ticked.
- **Cache classes:** the ledger and account-detail GETs send `X-Cache-Allow` as user-scoped, and 2xx writes carry the owner invalidation header. Navi warms none of these routes, so `navi/navi_config.yaml` does not change.
- **Lifecycle spec:** turn the four `it.todo((#166) ...)` cases in `backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts` into real tests (cleared-row locks, unlock after undo, anchor and currency locks, release after the last cancel).
- `accountant.e2e-spec.ts` and the bill-payment specs stay green and unchanged.

### Required tests

- Every bullet of `api/existing-routes.md` § Required tests: the `transactions.e2e-spec.ts` lock matrix, `accounts.e2e-spec.ts` and the typed account e2e specs, the three bill-payment undo routes, the ledger query units and the real-SQL integration spec, and the cache bullet.
- The four lifecycle `it.todo` cases above, now enabled.

### Out of scope

- The reconciliation routes themselves (done in #165).
- Folding the new error codes into `docs/agents/backend/routes/bank.md` and the module docs. That is #157.

## Solution

Follow `api/existing-routes.md`, using the entity from #164 and the helpers from #164 and #165 (`reconciliation-conflicts.ts`, the deadlock mapper, the lock order of `ReconciliationQuery`). Run the backend checks through `docker-compose run`.

## Benefits

- Reconciled history becomes protected.
- The data is ready for the ledger markers in #168.
