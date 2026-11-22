# Reconciliation API

Write `docs/agents/specs/reconciliation/api/reconciliations.md`: the new routes, served by a
new resident controller, `ReconciliationsController`. It is declared with
`@OwnerScopedController('bank')`, added to `backend/src/bank/bank-routes.module.ts`, and
delegates to a lazy `ReconciliationService`. It follows the shared rules of
`backend/routes/bank.md`: `.json`, `snake_case`, `@StrictBody()`, `parseId`, 404 before 403,
decimal-string amounts.

Routes (`<base>` = `/bank` or `/orgs/:orgId/bank`). Min roles are **provisional**: see step
06.

| Method | Route | Body | Success | Errors | Min role | Cache |
|---|---|---|---|---|---|---|
| GET | `<base>/accounts/:accountId/reconciliations.json?page=N` | — | 200 history envelope | 400 page; 404 | — | `user-scoped` |
| POST | `<base>/accounts/:accountId/reconciliations.json` | `statement_date`, `statement_balance` | 201 statement | 400; 404; 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_OPEN`, `RECONCILIATION_OUT_OF_ORDER`; 400 date before `opening_date` / future | `user` | `never` |
| GET | `<base>/accounts/:accountId/reconciliations/:id.json` | — | 200 statement | 404 | — | `user-scoped` |
| PATCH | `<base>/accounts/:accountId/reconciliations/:id.json` | `statement_date?`, `statement_balance?` | 200 statement | 400; 404; 409 `RECONCILIATION_FINISHED`, `RECONCILIATION_OUT_OF_ORDER`, `ACCOUNT_ARCHIVED` | `user` | `never` |
| DELETE | `<base>/accounts/:accountId/reconciliations/:id.json` | — | 204 (cancel, drops ticks) | 404; 409 `RECONCILIATION_FINISHED`, `ACCOUNT_ARCHIVED` | `admin` | `never` |
| PATCH | `<base>/accounts/:accountId/reconciliations/:id/ticks.json` | `tick: id[]`, `untick: id[]` (each ≤ 50, disjoint, at least one non-empty) | 200 statement | 400; 404 (an id not on the account); 409 `RECONCILIATION_FINISHED`, `TRANSACTION_NOT_ELIGIBLE`, `ACCOUNT_ARCHIVED` | `user` | `never` |
| POST | `<base>/accounts/:accountId/reconciliations/:id/finish.json` | `{}` | 200 statement | 404; 409 `RECONCILIATION_UNBALANCED`, `RECONCILIATION_FINISHED`, `ACCOUNT_ARCHIVED` | `user` | `never` |
| POST | `<base>/accounts/:accountId/reconciliations/:id/undo.json` | `{}` | 200 statement (now `open`) | 404; 409 `RECONCILIATION_NOT_LATEST`, `RECONCILIATION_OPEN`, `RECONCILIATION_NOT_FINISHED`, `ACCOUNT_ARCHIVED` | `admin` | `never` |

- **One bulk ticks route** serves both a single checkbox (one id) and "tick all on page /
  untick all" (up to the 50-row ledger page). The whole batch is applied in one DB transaction
  and fails as a whole. Ticking an already ticked row, or unticking an unticked one, is a
  no-op.
- **Statement response**:
  `{ id, status, statement_date, statement_balance, reconciled_at, cleared_balance,
  ticked_sum, difference, transaction_count, created_at, updated_at }`.
  On a finished statement, `difference` is `"0…"` and `ticked_sum` is the amount it cleared.
  Every write returns it, so the summary bar updates from the response.
- **History envelope** — `{ reconciliations: [...], pagination: {...} }`, newest first by
  `statement_date`, then `id`; 50 per page; the standard `pagination` block. It includes the
  open statement (at the top) so the UI can show "Continue". Each row carries `id`, `status`,
  `statement_date`, `statement_balance`, `reconciled_at`, `transaction_count` and `undoable`.
  `undoable` is true only on the latest finished statement when none is open.
- **Check order** — path 404, body 400, then 409. Archived → `ACCOUNT_ARCHIVED` before any
  state 409.
- **Concurrency** — writes lock the statement row (`SELECT … FOR UPDATE`, as in
  `bill-payment.writer.ts`), and the unique `open_key` backs the "one open" rule.
- **Error codes** — a table of every new code, with when it applies. The new codes go in
  `backend/src/core/error-codes.ts`, with factories in a new
  `backend/src/bank/reconciliation-conflicts.ts`, following `account-conflicts.ts`.
- **Caching** — GETs `user-scoped`, writes `never`. The class-level `InvalidatesOwner()` from
  `OwnerScopedController` already clears the owner's `/bank` subtree, which covers the ledger
  (ticked / cleared flags), the account detail (last reconciled) and the history. Navi warms
  nothing, and the proxy's `*.json` rule needs no change.

**Required tests** — `reconciliations.e2e-spec.ts` covering every route, error code and check
order under both base paths, role 403s, and a non-member 404. Unit specs for the service and
the difference.

## Files to Change
- `docs/agents/specs/reconciliation/api/reconciliations.md` — new; routes, payloads, error codes, cache.
