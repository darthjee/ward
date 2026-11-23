# Controller, module wiring and route discovery

Add `ReconciliationsController`, modelled on `bill-payments.controller.ts`:

- Declare it with `@OwnerScopedController('bank')`.
- Its constructor takes only `BankModuleLoader`, and it imports service **types** only, so the
  only resident code it adds is the controller itself.
- In each handler:
  1. call `parseId` on `accountId` and `id`; a malformed id gives the uniform 404;
  2. then call `const { reconciliations } = await this.loader.services()`.
- GETs take `@Query('page') rawPage` and run `parsePage`, so a malformed `page` is a 400.

| Handler | Route | Decorators |
|---|---|---|
| `list` | `GET accounts/:accountId/reconciliations.json` | (user-scoped default) |
| `create` | `POST accounts/:accountId/reconciliations.json` | `@MinOrgRole(OrgRole.USER)`, `@CachePolicy(CacheClass.Never)`, `@HttpCode(201)` |
| `show` | `GET accounts/:accountId/reconciliations/:id.json` | (user-scoped default) |
| `update` | `PATCH accounts/:accountId/reconciliations/:id.json` | `USER`, `Never`, 200 |
| `cancel` | `DELETE accounts/:accountId/reconciliations/:id.json` | `ADMIN`, `Never`, `@HttpCode(204)` |
| `ticks` | `PATCH accounts/:accountId/reconciliations/:id/ticks.json` | `USER`, `Never`, 200 |
| `finish` | `POST accounts/:accountId/reconciliations/:id/finish.json` | `USER`, `Never`, `@HttpCode(200)` |
| `undo` | `POST accounts/:accountId/reconciliations/:id/undo.json` | `ADMIN`, `Never`, `@HttpCode(200)` |

Watch the route ordering: `:id/ticks.json` must not be swallowed by `:id.json`. Follow how the
existing controllers declare their sub-resources.

The guard's 403 runs before the pipes. A pipe's 400 runs before the handler, so it runs before
the lazy load. As a result, a 403 or DTO 400 never loads `BankModule`.

Register the controller in `BankRoutesModule.controllers`. Add `'ReconciliationsController'` to
`KNOWN_CONTROLLERS`, keeping the list alphabetical, so that `cache-policy.coverage.spec.ts` and
`min-org-role.coverage.spec.ts` cover the new controller. Add a controller unit spec in the style
of `transactions.controller.spec.ts`.

## Files to Change
- `backend/src/bank/reconciliations.controller.ts` (new) — the eight routes.
- `backend/src/bank/bank-routes.module.ts` — register the controller.
- `backend/src/core/tests/support/route-discovery.ts` — add `'ReconciliationsController'` to
  `KNOWN_CONTROLLERS`.
- `backend/src/bank/tests/reconciliations.controller.spec.ts` (new) — the controller unit spec.
