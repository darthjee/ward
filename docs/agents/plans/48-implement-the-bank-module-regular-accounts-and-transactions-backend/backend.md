# Backend Plan: Implement the bank module, regular accounts and transactions — backend

Main plan: [plan.md](plan.md)

## Overview

This plan adds the `bank` module under `backend/src/bank/`:

- **Resident layer:**
  - `BankRoutesModule`, imported by `AppModule`, with three thin controllers
    (`AccountsController`, `TransactionsController`, `SettingsController`). All three are
    declared with `@OwnerScopedController('bank')`, read the owner with `@CurrentOwner()` and
    read bodies only through `@StrictBody()`.
  - The `Account` and `Transaction` entities, registered through `TypeOrmModule.forFeature` in
    the resident module so their metadata exists before the `DataSource` initialises.
  - A resident `BankConfigModule` that validates `BANK_DEFAULT_CURRENCY` at boot.
- **Lazy `BankModule`:** loaded through
  `LazyModuleLoaderService#loadOnFirstRequest(() => import('./bank.module.js').then(m => m.BankModule))`.
  It holds the account and transaction services, the ledger query, the `AccountTypeHandler`
  registry and the `regular` handler.

## Context

- The specs are the source of truth:
  - `docs/agents/specs/banking/README.md` (*Decisions*, *Bank ownership contract*)
  - `accounts/README.md`
  - `accounts/regular.md` (all but the *Accounts submenu UI* and the frontend tests)
  - `accounts/transactions.md` (all but the UI notes and the frontend tests)

  Do not re-decide what they settle. If a spec is unclear or wrong, raise it on issue #48.
- #46 provides the core primitives this module builds on, all in `backend/src/core/`:
  - `OwnerScopedController(path)` mounts `path` and `orgs/:orgId/path`, adds the owner-scoped
    metadata and sets `CacheClass.UserScoped`.
  - `CurrentOwner`.
  - `OwnerContext` and `ownerWhere(ctx)`. `ownerWhere` returns `{userId, organizationId: IsNull()}`
    or `{userId: IsNull(), organizationId}`, so the entity properties must be named exactly
    `userId` and `organizationId`.
  - `OwnerContextGuard` (the fourth `APP_GUARD`, with no admin bypass).
  - `parseOrgId` and `ownerNotFound()` (a bare `NotFoundException`, so every 404 body is
    identical).
  - `StrictBody()` / `StrictValidationPipe`.
  - `CachePolicy` / `CacheClass` and `CachePolicyInterceptor`. The interceptor sets
    `X-Skip-Cache` for every non-public class and forces non-GET requests to `never`.
- Ledger response envelope, fixed by the issue:

  ```json
  {
    "transactions": [ { "id": 7, "date": "2026-11-01", "amount": "-12.50",
                        "description": "…", "notes": null, "balance": "987.50" } ],
    "opening": { "date": "2026-10-01", "amount": "1000.00", "balance": "1000.00" },
    "pagination": { "page": 1, "per_page": 50, "total_pages": 3, "total_count": 120 }
  }
  ```

  - `opening` is set only on the last page and is `null` on every other page.
  - A `page` past the last page returns an empty `transactions` list with the same metadata.
  - A non-numeric `page` or a `page` below 1 returns 400.
- MySQL is 9.3.0 everywhere (dev, test and CI), so generated columns and enforced `CHECK`
  constraints are available. TypeORM supports both through `TableCheck` and the column options
  `generatedType` / `asExpression`.

## Steps

- [01 — Bank config (`BANK_DEFAULT_CURRENCY`) and currency helpers](backend/01-bank-config-and-currency.md)
- [02 — Migrations, entities and schema integration specs](backend/02-migrations-and-entities.md)
- [03 — Pure helpers: id parser, page parser, pagination envelope](backend/03-pure-helpers.md)
- [04 — Lazy `BankModule`: account type registry and account service](backend/04-account-service-and-type-registry.md)
- [05 — Transaction service and ledger query](backend/05-transactions-and-ledger.md)
- [06 — Resident `BankRoutesModule`, controllers and `AppModule` wiring](backend/06-resident-controllers.md)
- [07 — Bank e2e harness and owner-context / lazy-loading e2e specs](backend/07-e2e-specs.md)
- [08 — Documentation](backend/08-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)

## Notes

- **Name-uniqueness collation:** under MySQL 9's default `utf8mb4_0900_ai_ci`, the
  `active_name_key` unique indexes would also be **accent**-insensitive, so "Itaú" would clash
  with "Itau". The spec asks only for case-insensitivity.
  - Fix: give the generated column an explicit `utf8mb4_0900_as_cs` collation, so `LOWER()`
    alone provides the case-insensitivity.
  - Add one integration case showing that "Itaú" and "Itau" do not clash.
  - Mention this on the issue as a clarification; it does not deviate from the spec.
- **`active_name_key` is a generated column.** Either leave it unmapped in the `Account` entity
  or map it with `insert: false, update: false`. Otherwise TypeORM writes to it and MySQL
  rejects the INSERT.
- **`BIGINT` values arrive as strings** from mysql2. Use a column transformer to convert them
  to `bigint`, and do every conversion between minor units and decimal strings in the pure
  helper from step 01. Never use floats.
- **Testing the lazy module:** repository overrides in `Test.createTestingModule` probably do
  not reach a lazily loaded module. The e2e harness therefore uses `NestFactory.create` with a
  `@Global()` fake `DataSource` (see step 07).
  - The ledger's window-function SQL cannot run on the in-memory repository, so it sits behind a
    small query class. Unit tests fake that class, and a MySQL integration spec covers the real
    SQL.
- **`LazyModuleLoaderService`** is provided only in `AppModule` and is not exported, so
  `BankRoutesModule` must list it in its own `providers`. It is stateless, and Nest's
  `LazyModuleLoader` caches the loaded module.
- **Reviews:** after implementation, the coordinator runs the `security`, `data-access` and
  `cache` reviews.
  - Navi stays unchanged, because every bank route is `user-scoped` or `never`.
  - The `cache` agent only confirms the exclusion and the `X-Skip-Cache` headers.
- **Out of scope:**
  - the frontend (#49);
  - debt, investment and provider-expense accounts (#50, #52, #54) and bills (#56), apart from
    the extension point;
  - `modules/bank.md` and folding the specs.
