# Reconciliation — Reconciliation API

Part of the [Reconciliation spec](../README.md). This file defines the new routes, served by a new
resident controller, `ReconciliationsController`. It is declared with
`@OwnerScopedController('bank')`, added to `backend/src/bank/bank-routes.module.ts`, and
delegates to a lazy `ReconciliationService`. It follows the shared rules of
[Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md):
`.json` URLs, `snake_case`, `@StrictBody()`, `parseId`, 404 before 403, decimal-string amounts.

## Routes

`<base>` is `/bank` or `/orgs/:orgId/bank`. The minimum roles are **provisional** (see
[security.md](../security.md#open-concerns)).

| Method | Route | Body | Success | Errors | Min role | Cache |
|---|---|---|---|---|---|---|
| GET | `<base>/accounts/:accountId/reconciliations.json?page=N` | — | 200 history envelope | 400 page; 404 | — | `user-scoped` |
| POST | `<base>/accounts/:accountId/reconciliations.json` | `statement_date`, `statement_balance` | 201 statement | 400 (including a date before `opening_date` or in the future); 404; 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_OPEN`, `RECONCILIATION_OUT_OF_ORDER` | `user` | `never` |
| GET | `<base>/accounts/:accountId/reconciliations/:id.json` | — | 200 statement | 404 | — | `user-scoped` |
| PATCH | `<base>/accounts/:accountId/reconciliations/:id.json` | `statement_date?`, `statement_balance?` | 200 statement | 400; 404; 409 `RECONCILIATION_FINISHED`, `RECONCILIATION_OUT_OF_ORDER`, `ACCOUNT_ARCHIVED` | `user` | `never` |
| DELETE | `<base>/accounts/:accountId/reconciliations/:id.json` | — | 204 (cancel, drops ticks) | 404; 409 `RECONCILIATION_FINISHED`, `ACCOUNT_ARCHIVED` | `admin` | `never` |
| PATCH | `<base>/accounts/:accountId/reconciliations/:id/ticks.json` | `tick: id[]`, `untick: id[]` (each at most 50, disjoint, at least one non-empty) | 200 statement | 400; 404 (an id not on the account); 409 `RECONCILIATION_FINISHED`, `TRANSACTION_NOT_ELIGIBLE`, `ACCOUNT_ARCHIVED` | `user` | `never` |
| POST | `<base>/accounts/:accountId/reconciliations/:id/finish.json` | `{}` | 200 statement | 404; 409 `RECONCILIATION_UNBALANCED`, `RECONCILIATION_FINISHED`, `ACCOUNT_ARCHIVED` | `user` | `never` |
| POST | `<base>/accounts/:accountId/reconciliations/:id/undo.json` | `{}` | 200 statement (now `open`) | 404; 409 `RECONCILIATION_NOT_LATEST`, `RECONCILIATION_OPEN`, `RECONCILIATION_NOT_FINISHED`, `ACCOUNT_ARCHIVED` | `admin` | `never` |

- **One bulk ticks route** serves both a single checkbox (one id) and "tick all on page / untick
  all" (up to the 50-row ledger page). The whole batch is applied in one DB transaction and fails
  as a whole. Ticking an already ticked row, or unticking an unticked one, is a no-op.
- **Statement response**:
  `{ id, status, statement_date, statement_balance, reconciled_at, cleared_balance, ticked_sum,
  difference, transaction_count, created_at, updated_at }`. On a finished statement, `difference`
  is `"0…"` and `ticked_sum` is the amount it cleared. Every write returns it, so the summary bar
  updates from the response.
- **History envelope**: `{ reconciliations: [...], pagination: {...} }`, newest first by
  `statement_date` then `id`, 50 per page, with the standard `pagination` block. It includes the
  open statement (at the top) so the UI can show "Continue". Each row carries `id`, `status`,
  `statement_date`, `statement_balance`, `reconciled_at`, `transaction_count` and `undoable`.
  `undoable` is true only on the latest finished statement when none is open.

## Check order

Path 404, body 400, then 409. An archived account answers `ACCOUNT_ARCHIVED` before any state 409.

## Concurrency

Writes lock the statement row (`SELECT … FOR UPDATE`, as in `bill-payment.writer.ts`), and the
unique `open_key` backs the "one open" rule.

## Error codes

The new codes go in `backend/src/core/error-codes.ts`, with factories in a new
`backend/src/bank/reconciliation-conflicts.ts`, following `account-conflicts.ts`. All are 409.

| Code | When |
|---|---|
| `RECONCILIATION_OPEN` | Start while a statement is open; undo while a statement is open |
| `RECONCILIATION_FINISHED` | Edit, tick, cancel or finish on a finished statement |
| `RECONCILIATION_NOT_FINISHED` | Undo on a statement that is not finished |
| `RECONCILIATION_NOT_LATEST` | Undo on a finished statement that is not the latest |
| `RECONCILIATION_OUT_OF_ORDER` | A `statement_date` not strictly after the latest finished statement |
| `RECONCILIATION_UNBALANCED` | Finish while the difference is not 0 |
| `TRANSACTION_NOT_ELIGIBLE` | Tick of a row outside the date range, before the anchor, or cleared by another statement |
| `TRANSACTION_CLEARED` | See [existing-routes.md](existing-routes.md) |
| `ACCOUNT_RECONCILED` | See [existing-routes.md](existing-routes.md) |
| `ACCOUNT_ARCHIVED` | Existing code, reused for every write |

## Caching

GETs are `user-scoped`, writes are `never`. The class-level `InvalidatesOwner()` from
`OwnerScopedController` already clears the owner's `/bank` subtree, which covers the ledger
(ticked and cleared flags), the account detail (last reconciled) and the history. Navi warms
nothing, and the proxy's `*.json` rule needs no change.

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)
- [Caching](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md)
- [`bill-payment.writer.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/bill-payment.writer.ts)
- [`account-conflicts.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/account-conflicts.ts)

## Required tests

- `reconciliations.e2e-spec.ts`: every route, every error code and the check order, under both
  base paths; role 403s; a non-member 404.
- Unit specs for `ReconciliationService` and the difference.

Back to the [README](../README.md).
