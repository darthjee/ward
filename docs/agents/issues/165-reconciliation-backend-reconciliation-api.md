# Issue: Reconciliation — backend: reconciliation API

## Description

Part of epic #85 (Reconciliation: statement checkpoints). This issue adds the new reconciliation routes: start, edit, list/get, tick/untick, finish, cancel and undo, under both `/bank` and `/orgs/<id>/bank`, with the lifecycle end-to-end spec.

**Owner:** `backend`. **Depends on:** #164 (migration and entity, merged). **Parallel with:** #166. **Blocks:** #167 (frontend reconcile mode and history). Needs a `security` review and a `cache` review when it finishes.

**Source of truth:** the finished specs in [`docs/agents/specs/reconciliation/`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/README.md):

- [`model.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/model.md): entity, formulas, lifecycle and lock matrix.
- [`api/reconciliations.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/api/reconciliations.md): routes, payloads, check order, concurrency, error codes and caching.
- [`security.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/security.md): roles, ownership, input bounds, concurrency, memory and lazy loading.

## Problem

After #164 the schema, entity, conflict factories and balance/eligibility helpers exist, but there is no way to start a statement, tick rows, finish, cancel or undo.

## Expected Behavior

- A new resident `ReconciliationsController` (`@OwnerScopedController('bank')`, added to `bank-routes.module.ts`) delegates to a lazy `ReconciliationService` and implements the routes, payloads, check order and error codes of `api/reconciliations.md`, with the role rules (start, edit, ticks and finish need `user`; cancel and undo need `admin`; the personal context counts as `owner`) and the uniform 404 for foreign accounts and statements.
- Cache classes: every GET is `user-scoped` (`X-Cache-Allow`), every write is `never` (`X-Skip-Cache`), and a 2xx write carries the `x-cache-invalidate` header for `/bank` (or `/orgs/<id>/bank`) while a 409 does not.
- Input bounds (ticks arrays, dates, balances, extra fields) and concurrency (concurrent start, undo versus start, tick versus transaction edit, finish versus tick) follow `security.md`, with the fixed lock order account → statement → transaction rows (ascending id).
- **Deadlock 409 (owned here):** an unexpected `ER_LOCK_DEADLOCK` maps to a uniform 409 with fixed text, never a 500. This issue adds the new error code to `backend/src/core/error-codes.ts`, its constant to `mysql-errors.ts`, and a shared mapper in `reconciliation-conflicts.ts`, and applies it to every reconciliation write. #166 reuses the same mapper on the existing locked routes.
- `BankModule` is loaded through the lazy loader once per request, and a request rejected by the role 403 or the DTO 400 does not load it.
- A new end-to-end spec `backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts` runs the whole lifecycle under both base paths, using the `describe.each(CONTEXTS)` pattern of `bill-payments.e2e-spec.ts`.
- Sequencing with #166: the lifecycle spec's lock steps (step 4, and the anchor/currency lock assertions in step 6) exercise lock behaviour that #166 adds to the existing routes. #165 and #166 may merge in either order; whichever merges second makes sure those assertions are in place and green. If #166 has not merged when this issue is implemented, write the rest of the lifecycle spec now and leave those assertions to the later merge. The locks themselves are **not** implemented here.

### Required tests

- `api/reconciliations.md` § Required tests (every bullet, including `reconciliations.e2e-spec.ts`, `reconciliation-lifecycle.e2e-spec.ts`, the `org-roles.e2e-spec.ts` matrix update, the concurrent-start 409 and the `ReconciliationService` unit specs).
- `security.md` § Required tests (ownership, bounds, roles, concurrency, cache and invalidation, lazy loading).
- A unit spec for the deadlock mapper (a MySQL-shaped `ER_LOCK_DEADLOCK` becomes the 409 with fixed text; other errors pass through).
- `accountant.e2e-spec.ts` and the bill-payment specs stay green and unchanged.

## Solution

Follow `api/reconciliations.md`, building on the entity, `reconciliation-conflicts.ts`, `reconciliation-balance.ts`, `reconciliation-eligibility.ts` and the `AccountBalancesQuery` / `LedgerQuery` additions from #164, and the in-memory test repos it introduced. Use `bill-payment.writer.ts` as the model for the locking transaction and the `ER_DUP_ENTRY` → 409 mapping. Run the backend checks through `docker-compose run`. Navi warms nothing for these routes (all GETs are user-scoped), so `navi/navi_config.yaml` does not change.

## Benefits

- The reconcile workflow becomes available through the API, ready for the frontend (#167).
- Deadlock handling is defined once and shared with #166, so no locked write leaks a 500.
