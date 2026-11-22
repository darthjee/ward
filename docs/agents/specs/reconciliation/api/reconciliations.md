# Reconciliation — Reconciliation API

Part of the [Reconciliation spec](../README.md). This file defines the new routes, served by a new
resident controller, `ReconciliationsController`. It is declared with
`@OwnerScopedController('bank')`, added to `backend/src/bank/bank-routes.module.ts`, and
delegates to a lazy `ReconciliationService`. It follows the shared rules of
[Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md):
`.json` URLs, `snake_case`, `@StrictBody()`, `parseId`, 404 before 403, decimal-string amounts.

## Routes

`<base>` is `/bank` or `/orgs/:orgId/bank`. Each write route declares `@MinOrgRole`, enforced by
`OwnerContextGuard`, with the minimum role in the table below. The pattern is the one of
[Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md#minimum-role):
everyday writes need `user`, cancel is a DELETE, and undo reverses a finished statement like a
payment undo, so both need `admin`. The reasoning is in [security.md](../security.md#decided).

| Method | Route | Body | Success | Errors | Min role | Cache |
|---|---|---|---|---|---|---|
| GET | `<base>/accounts/:accountId/reconciliations.json?page=N` | — | 200 history envelope | 400 page; 404 | — | `user-scoped` |
| POST | `<base>/accounts/:accountId/reconciliations.json` | `statement_date`, `statement_balance` | 201 statement | 400 (including a date before `opening_date` or later than UTC today + 1 day, or a balance beyond the bound); 404; 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_OPEN`, `RECONCILIATION_OUT_OF_ORDER` | `user` | `never` |
| GET | `<base>/accounts/:accountId/reconciliations/:id.json` | — | 200 statement | 404 | — | `user-scoped` |
| PATCH | `<base>/accounts/:accountId/reconciliations/:id.json` | `statement_date?`, `statement_balance?` | 200 statement | 400; 404; 409 `RECONCILIATION_FINISHED`, `RECONCILIATION_OUT_OF_ORDER`, `ACCOUNT_ARCHIVED` | `user` | `never` |
| DELETE | `<base>/accounts/:accountId/reconciliations/:id.json` | — | 204 (cancel, drops ticks) | 404; 409 `RECONCILIATION_FINISHED`, `ACCOUNT_ARCHIVED` | `admin` | `never` |
| PATCH | `<base>/accounts/:accountId/reconciliations/:id/ticks.json` | `tick: id[]`, `untick: id[]` (bounds in [security.md](../security.md#input-bounds)) | 200 statement | 400; 404 (an id not on the account, in either array); 409 `RECONCILIATION_FINISHED`, `TRANSACTION_NOT_ELIGIBLE`, `ACCOUNT_ARCHIVED` | `user` | `never` |
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

The order is fixed, and matches `OwnerContextGuard` and Routes — Bank ("404 before 403"):

1. Org or non-member 404, then the role 403 (the guard throws 403 only after membership is
   resolved), so a `user` calling cancel or undo gets 403 for any statement id, even one that does
   not exist.
2. DTO-shape 400 from `@StrictBody()` (types, array size, unknown fields, the date rule). Pipes
   run before the handler, so this precedes the path 404. It never depends on foreign data, so it
   leaks nothing.
3. Path 404: `parseId` on the account, the owner-scoped account lookup, the statement by
   `{ id, accountId }`, then the ticks ids (a single account-scoped query).
4. Account-dependent 400: the balance against the account currency, `statement_date` before
   `opening_date`, empty or overlapping ticks.
5. `ACCOUNT_ARCHIVED`, then the state 409s. Within a ticks batch the state order is
   `RECONCILIATION_FINISHED`, then `TRANSACTION_NOT_ELIGIBLE`.

No 409 can be reached by a non-member, so a statement's state is never disclosed outside the
account's members. Every 409 message is fixed text (see
[security.md](../security.md#decided)).

## Concurrency

Every write runs in one DB transaction, locking the account row, then the statement row, then the
transaction rows in ascending id order (`SELECT … FOR UPDATE`, as in `bill-payment.writer.ts`), and
the unique `open_key` backs the "one open" rule. The race outcomes are:

- **Two concurrent starts** — the loser's unique `open_key` violation maps to 409
  `RECONCILIATION_OPEN`, never 500.
- **Undo vs. start** — the account lock serialises them, and the loser answers 409
  `RECONCILIATION_OPEN`.
- **Tick vs. transaction PATCH or DELETE** — the tick locks the rows and re-checks eligibility
  inside the transaction, and the transaction write locks its row and checks `reconciliationId`
  on current data.
- **Finish vs. tick** — finish recomputes the difference under the lock, and a tick after finish
  answers 409 `RECONCILIATION_FINISHED`.

See [security.md](../security.md#concurrency) for the full list.

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
  base paths; a non-member 404.
- Role 403s, under the org base path only: a `user` gets 403 on cancel and undo, even with an
  invalid body (403 before 400), and `admin` and `owner` get through. A `user` is allowed on
  start, edit, ticks and finish. The personal context counts as `owner`.
- The concurrent-start 409 `RECONCILIATION_OPEN`, and the 404 for a statement of a sibling
  account. The bounds are in [security.md](../security.md#required-tests).
- Unit specs for `ReconciliationService` and the difference.

Back to the [README](../README.md).
