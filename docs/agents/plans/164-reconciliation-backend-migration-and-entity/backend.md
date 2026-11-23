# Backend Plan: Reconciliation — backend: migration and entity

Main plan: [plan.md](plan.md)

## Overview
This adds the schema, entity, helpers, queries and test support for reconciliation statements, following
[`docs/agents/specs/reconciliation/model.md`](../../specs/reconciliation/model.md) and the
migration, concurrency and memory parts of
[`security.md`](../../specs/reconciliation/security.md). It adds no controller, no route and no response change.
Everything stays inside the lazy bank module (`backend/src/bank/`) and `backend/src/database/`.

## Context
- Issue #164 is the data foundation and blocks #165 (reconciliation API) and #166 (locks on existing routes).
- **Scope boundary with #166:**
  - #164 changes the **query layer** only:
    - `LedgerRow` gains `reconciliation`, through the scoped `LEFT JOIN`;
    - `LedgerQuery` gains `lastReconciledDate()`;
    - `AccountBalancesQuery` gains the cleared-balance and ticked-sum queries.
  - #164 leaves `transaction.service.ts` `ledger()`, `serializeLedger` / `transaction-response.ts` and every other response shape unchanged. #166 wires the new fields into the envelope and the responses.
- `'ReconciliationsController'` is **not** added to `KNOWN_CONTROLLERS`
  (`backend/src/core/tests/support/route-discovery.ts`). #165 adds it together with the controller.
- **No behaviour change:** the existing specs, `accountant.e2e-spec.ts` and the bill-payment specs must stay green and **unchanged**. The two exceptions are the mechanical updates listed in the steps: constructor wiring in specs that build queries directly, and the hard-coded table list in the round-trip spec.

## Steps

- [01 — Migration](backend/01-migration.md)
- [02 — Entity and Transaction change](backend/02-entity.md)
- [03 — Error codes and conflict factories](backend/03-conflicts.md)
- [04 — Formula and eligibility helpers](backend/04-helpers.md)
- [05 — Balance and ledger queries](backend/05-queries.md)
- [06 — Test support (fake data source, in-memory repos and queries)](backend/06-test-support.md)
- [07 — Integration specs](backend/07-integration-specs.md)

Steps 02 and 06 have to land together to keep the bank e2e suite green: once `Reconciliation` is in
`forFeature`, the fake data source must know about it.

## CI Checks
- `backend` lint: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend` typecheck: `docker-compose run --rm ward_tests yarn typecheck` (CI job: `backend_typecheck`)
- `backend` unit and e2e with coverage: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend` integration (MySQL): `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
- `backend` build: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)
- Optional dev-DB round trip: `docker-compose run --rm ward_app yarn migration:run` then `yarn migration:revert`

## Notes
- **Never run tooling on the host.** Always go through `docker-compose run`.
- **`max-lines`:** `bank/tests/support/in-memory-bank-repos.ts` is already at 300 lines, the `max-lines` warning threshold for non-spec files. Put the reconciliation rules in a new support file instead of growing it (see step 06).
- **Ledger SQL:** the `LedgerQuery` constructor and the SQL parameter order change. Update `bank/tests/ledger.query.spec.ts` and `database/tests/integration/ledger.integration-spec.ts` accordingly, and keep their existing assertions otherwise intact.
- **`ER_LOCK_DEADLOCK` deferred:** the retry-style 409 for this error (security.md § Concurrency) has no named code in the specs. It belongs to the write paths, so it is deferred to #165/#166. Do not invent it here.
- **Out of scope here:** no `security` or `cache` review is needed, since no endpoint is added. `navi/` does not change.
- **Rollback:** reconcile data is lost on rollback (`down()` drops the table), as the spec decides.
