# Backend Plan: Reconciliation — backend: locks on existing routes

Main plan: [plan.md](plan.md)

## Overview

Wire the #164 entity and the #165 helpers into the existing bank routes, following
[`api/existing-routes.md`](../../specs/reconciliation/api/existing-routes.md), the lock matrix in
[`model.md`](../../specs/reconciliation/model.md#lock-matrix) and
[`security.md` § Concurrency](../../specs/reconciliation/security.md#concurrency).

## Context

#165 left most of the building blocks ready. They are reused here and not re-implemented:

- `reconciliation-conflicts.ts`: `transactionCleared()`, `accountReconciled()`,
  `concurrentUpdate()` and `mapDeadlock()`.
- `reconciliation-guards.ts`: `lockAccount(manager, owner, accountId)` (owner-scoped
  `pessimistic_write`, 404 otherwise) and `lockStatement`.
- `ReconciliationQuery`: `lockTransactions(manager, accountId, ids)` (ascending id
  `FOR UPDATE`), `untick(...)`, `openStatement(accountId, manager?)` and
  `latestFinished(accountId, manager?)`.
- `reconciliation-eligibility.ts`: `shouldAutoUntick(newDate, openStatement, account)`.
- `LedgerQuery.page()` already returns `reconciliation` per row, with the account-scoped
  `LEFT JOIN` placed outside the window subquery. `LedgerQuery.lastReconciledDate()` exists.
  Both have unit and integration coverage, and the in-memory twin supports both.
- Every error code already exists in `core/error-codes.ts`.
- The mass-assignment 400 already comes from `@StrictBody()` (`forbidNonWhitelisted`), so
  `reconciliation_id` and `reconciliation` in a body only need test assertions.

What is missing:

- The ledger serializer drops `reconciliation`, and the envelope has no `last_reconciled_date`.
- Transaction `update()` and `delete()` run no DB transaction and take no lock. The current
  check order (ARCHIVED, 404, 403, then the amount 400) does not match the spec.
- Account `update()` takes no account lock and has no statement checks.
- `undoPayment()` / `BillPaymentWriter.remove()` take no lock and know nothing about statements.

No migration: the schema came in #164.

## Steps

- [01 — Ledger response fields](backend/01-ledger-response-fields.md)
- [02 — Transaction PATCH/DELETE locks](backend/02-transaction-locks.md)
- [03 — Account anchor and currency locks, detail fields](backend/03-account-locks-and-detail.md)
- [04 — Bill-payment undo lock](backend/04-bill-payment-undo-lock.md)
- [05 — Lifecycle spec and cache assertions](backend/05-lifecycle-and-cache-specs.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm --no-deps ward_tests yarn typecheck` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)

## Notes

- **File size.** `account.service.ts` is about 290 lines, close to the 300-line limit. Put the new
  account checks in a helper file (for example `account-reconciliation-guard.ts`), not inline.
  Apply the same rule to `transaction.service.ts` (221 lines) if the locked write grows it: move
  the locked update/delete body into a `transaction.writer.ts` or similar.
- **Mocks in e2e specs.** As soon as `TransactionService`, `AccountService` or the bill-payment
  writer depend on `ReconciliationQuery`, every e2e spec that builds them needs
  `jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'))`.
  The issue says `accountant.e2e-spec.ts` and the bill-payment specs "stay green and unchanged".
  Read that as "their existing cases keep passing without edits". Adding the mock line, and the
  new cases that the spec requires in `bill-payments.e2e-spec.ts`, is acceptable. If a lighter
  dependency (for example a plain repository `findOne` / `exists` on `Reconciliation`) avoids the
  extra mock, prefer it.
- **Lock order.** Every write here follows account, then statement, then transaction rows, all
  inside `mapDeadlock(() => manager.transaction(...))`. A bill-payment undo can touch two accounts
  (the source and the paying account), so lock both account rows in ascending id order before any
  transaction row.
- **`currencyLocked()` text** in `account-conflicts.ts` says "once the account has transactions".
  Widen it to cover statements, keeping the error-body rules (fixed text, no detail).
- **Out of scope:** the reconciliation routes (#165), and folding the new error codes into
  `docs/agents/backend/routes/bank.md` and the module docs (#157).
- **Reviews after implementation:** `security` (new lock and auth paths, user input), and `cache`
  (expected outcome: ledger and account-detail GETs are `user-scoped` with `X-Cache-Allow`,
  writes are `never` with the owner invalidation, and `navi/navi_config.yaml` does not change).
