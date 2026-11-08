# Resident `BankRoutesModule`, controllers and `AppModule` wiring

Expose the routes. Controllers are thin: they parse the ids and the page, load `BankModule`
lazily, and delegate to its services.

## `bank/bank-routes.module.ts` (resident)

- **Imports:** `TypeOrmModule.forFeature([Account, Transaction])`, which registers the entity
  metadata at boot, and `BankConfigModule`.
- **Controllers:** `AccountsController`, `TransactionsController` and `SettingsController`.
- **Providers:** `LazyModuleLoaderService`, because `AppModule` does not export it.
- **Shared loader:** a `BankModuleLoader` helper wraps
  `loadOnFirstRequest(() => import('./bank.module.js').then(m => m.BankModule))` and
  `moduleRef.get(Service)`, so each controller handler is one line.

## Controllers

Every controller is declared with `@OwnerScopedController('bank')`, reads `@CurrentOwner()`
and takes bodies only through `@StrictBody()`. GET routes inherit `user-scoped`, and every
write is explicitly `@CachePolicy(CacheClass.Never)`.

### `AccountsController`

- `GET accounts.json` (query DTO: `type`, `archived`)
- `POST accounts.json`
- `GET accounts/:accountId.json`
- `PATCH accounts/:accountId.json`
- `DELETE accounts/:accountId.json`
- `POST accounts/:accountId/archive.json`
- `POST accounts/:accountId/unarchive.json`

### `TransactionsController`

- `GET accounts/:accountId/transactions.json?page=N`
- `POST accounts/:accountId/transactions.json`
- `PATCH accounts/:accountId/transactions/:transactionId.json`
- `DELETE accounts/:accountId/transactions/:transactionId.json`

### `SettingsController`

- `GET settings.json` returns `{ default_currency }`, read from `BANK_CONFIG`.

### Shared rules

- `:accountId` and `:transactionId` go through `parseId`, which answers 404 and never 400.
- The page goes through `parsePage`.
- Choose the status codes to match the existing organization controller: 201 on create, 200 on
  the other writes, and 204 on delete if that is the convention there.
- Request and response bodies are never logged. Check that nothing in the logging middleware
  logs bodies.

## Wiring

- **`AppModule`:** import `BankRoutesModule` instead of the temporary `BankConfigModule` import
  and the temporary `forFeature` from earlier steps. It must never import `BankModule`.
- **`core/tests/cache-policy.coverage.spec.ts`:** add the three controllers to
  `KNOWN_CONTROLLERS`. The spec must pass for every new route: there is a cache class
  everywhere, no owner-scoped route is public, and no handler uses a plain `@Body()`.
- **Jest coverage config:** exclude `bank-routes.module.ts` and `bank.module.ts` from coverage
  only if they end up holding pure wiring, as `mail.module.ts` does.

## Tests

Controller unit specs with a fake loader, checking that each handler delegates to the right
service with the owner and the parsed ids.

## Files to Change

- `backend/src/bank/bank-routes.module.ts` — new.
- `backend/src/bank/bank-module.loader.ts` — new: the lazy-load helper.
- `backend/src/bank/accounts.controller.ts` — new.
- `backend/src/bank/transactions.controller.ts` — new.
- `backend/src/bank/settings.controller.ts` — new.
- `backend/src/app.module.ts` — import `BankRoutesModule`.
- `backend/src/core/tests/cache-policy.coverage.spec.ts` — add the bank controllers to `KNOWN_CONTROLLERS`.
- `backend/jest.config.*` — add coverage exclusions only if needed.
- `backend/src/bank/tests/accounts.controller.spec.ts`, `transactions.controller.spec.ts`, `settings.controller.spec.ts` — new.
