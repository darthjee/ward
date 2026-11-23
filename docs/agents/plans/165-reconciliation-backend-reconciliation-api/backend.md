# Backend Plan: Reconciliation — backend: reconciliation API

Main plan: [plan.md](plan.md)

## Overview

This plan implements the routes, payloads, check order, concurrency, error codes and caching in
[`api/reconciliations.md`](../../specs/reconciliation/api/reconciliations.md) and the bounds and
roles in [`security.md`](../../specs/reconciliation/security.md). It builds on what #164 delivered:

- the `Reconciliation` entity;
- `reconciliation-conflicts.ts`, including `mapOpenClash`;
- `reconciliation-balance.ts` and `reconciliation-eligibility.ts`;
- `AccountBalancesQuery.clearedBalance` / `tickedSum`;
- the in-memory reconciliation repos.

## Context

- #164 is merged. #166 (locks on the existing routes: `TRANSACTION_CLEARED`,
  `ACCOUNT_RECONCILED`, the wider `CURRENCY_LOCKED`) is **not** merged yet. `transactionCleared()`
  and `accountReconciled()` exist but nothing calls them. This issue does **not** implement those
  locks.
- Roles: start, edit, ticks and finish need `OrgRole.USER`. Cancel and undo need
  `OrgRole.ADMIN`. GETs have no `@MinOrgRole`. The personal context counts as `owner`.
- Cache: the controller is `@OwnerScopedController('bank')`, so it is class-level
  `UserScoped` + `InvalidatesOwner()`. Each write adds `@CachePolicy(CacheClass.Never)`. Do not
  use `NoCacheInvalidation()` or `InvalidatesPaths()`. Navi and the proxy do not change.
- Lock order inside every write: account row → statement row → transaction rows (ascending id),
  each `pessimistic_write`, inside one `manager.transaction`. This is the model of
  `bill-payment.writer.ts`.
- Lint limits: `max-lines` 300, `complexity` 10, `max-depth` 4. Split the service into small
  collaborators instead of one large file.

## Steps

- [01 — Deadlock 409 mapper](backend/01-deadlock-mapper.md)
- [02 — Request DTOs](backend/02-request-dtos.md)
- [03 — Statement queries and response presenter](backend/03-queries-and-presenter.md)
- [04 — ReconciliationService and writers](backend/04-reconciliation-service.md)
- [05 — Controller, module wiring and route discovery](backend/05-controller-and-wiring.md)
- [06 — Per-route e2e spec, role matrix and lazy loading](backend/06-route-e2e-specs.md)
- [07 — Lifecycle e2e spec](backend/07-lifecycle-e2e-spec.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn typecheck` (CI job: `backend_typecheck`)
- `backend`: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job:
  `backend_integration`). Run it only if a new SQL query is added in step 03.

Never run `yarn`/`node` on the host. Always use `docker-compose run`.

## Notes

- **#166 sequencing.** In the lifecycle spec, step 4 (the cleared-row locks, and the anchor and
  currency locks on the account) and step 6 (the lock release or hold) depend on #166:
  - If #166 has not merged when this is implemented, write the rest of the spec now. Leave those
    assertions out, or add them as `it.todo` with a comment pointing at #166.
  - Whichever PR merges second makes them real and green.
- **In-memory repos.** These have no `update`, `count` or `createQueryBuilder`. The bulk tick and
  untick, and the grouped `COUNT`, need either:
  - a narrow query class (mocked in e2e like `ledger.query.ts`), or
  - small additions to the in-memory repos.

  Prefer a query class (`reconciliation.query.ts`) so production stays one bulk `UPDATE` per
  array and one grouped `COUNT`, with no entity hydration (security.md § Memory).
- **`bank-module.loader.spec.ts`** asserts `services` with `toEqual` on a partial list. Add
  `reconciliations` in the same way the existing entries are handled.
- **Reviews after implementation:**
  - `security`: the new endpoints, roles, input bounds and concurrency.
  - `cache`: the cache classes and `x-cache-invalidate`. Expected result: no Navi change.
- No 409 or 400 message may contain a balance, difference, date, id or count. No request bodies
  are logged.
