# Issue: Reconciliation — backend: migration and entity

## Description

Part of epic #85 (Reconciliation: statement checkpoints). This is the data foundation: the `bank_reconciliations` table, the nullable `reconciliation_id` FK on `bank_transactions`, the `Reconciliation` entity, the `Transaction` change, the balances and ledger query changes, and the shared helpers the later backend issues build on. No route is added or changed here.

**Owner:** `backend`. **Depends on:** nothing. **Blocks:** #165 (reconciliation API) and #166 (locks on existing routes).

**Source of truth:** the finished specs in [`docs/agents/specs/reconciliation/`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/README.md). Read these files:

- [`model.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/model.md): entity, `Transaction` change, formulas, queries and indexes, statement lifecycle, lock matrix, migration and backward compatibility.
- [`security.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/security.md): input bounds, concurrency, memory and migration decisions (the migration, concurrency and memory parts apply here).

## Problem

Ward has no way to record that the ledger agreed with a bank statement at a given date, so nothing protects reconciled rows. The schema, entities and queries for that do not exist yet.

## Expected Behavior

- A migration (`<YYYYMMDD>120027-bank-create-reconciliations.ts`) creates the `bank_reconciliations` table and adds `reconciliation_id` to `bank_transactions` with `ON DELETE SET NULL`, with `account_id` cascading on account delete and the generated `open_key` unique index (one open statement per account), exactly as in `model.md` § Migration, with a working `down()`.
- The `Reconciliation` entity and the `Transaction` change match `model.md`.
- The formula helpers (cleared balance, ticked sum, difference, anchor and debt sign) and the eligibility helpers (dated after `statementDate`, dated before `openingDate`, cleared by another statement), plus the auto-untick rule, match `model.md` § Formulas and § Statement lifecycle.
- The SQL queries match `model.md` § Queries and indexes: the balances query (`account-balances.query.ts`) computes the cleared balance (rows before the anchor excluded, only finished statements joined, rows of other accounts never counted), and the ledger query gets the scoped `reconciliation` join and `last_reconciled_date`. Their in-memory test versions are updated to match.
- The 409 conflict factories (one per `ErrorCodes` entry, with its fixed text) exist.
- The test support is extended: a `Reconciliation` repository in the fake data source, the unique-open rule, `pessimistic_write`, SET NULL on cancel and cascade in the in-memory repositories, and the migration in `MIGRATIONS` of `test-data-source.ts`.
- `'ReconciliationsController'` is **not** added to `KNOWN_CONTROLLERS` here: no controller exists yet, so `cache-policy.coverage.spec.ts` and `min-org-role.coverage.spec.ts` would fail. #165 adds that entry together with the controller.
- Existing behaviour does not change: the existing specs, `accountant.e2e-spec.ts` and the bill-payment specs stay green and unchanged.

### Required tests

- `model.md` § Required tests, every bullet, including the integration specs that check the formulas against the real balances and ledger SQL. The one exception is the `KNOWN_CONTROLLERS` entry, which moves to #165.
- The migration, concurrency and memory bullets of `security.md` § Required tests that concern the schema (migration round trip, unique-open index).

The routes' own tests (ownership, bounds, roles, cache, lazy loading) belong to #165 and #166.

## Solution

Follow `model.md`. Keep the new entity, queries and helpers inside the existing bank module. Run the backend checks through `docker-compose run` as usual. No `security` or `cache` review is needed (no endpoint is added).

## Benefits

- Gives the two route issues (#165, #166) a shared, tested schema, query and helper set to build on.
