# Add `AccountantController` and wire the modules
Add the thin resident controller in `accountant.controller.ts`, declared with
`@OwnerScopedController('bank')` so it mounts under both `bank` and `orgs/:orgId/bank`.

| Route | Handler arguments | Delegates to | Cache class |
|---|---|---|---|
| `@Get('accountant/charges.json')` | `@CurrentOwner()` and `@Query(QUERY_PIPE) query: AccountantChargesQueryDto` | `accountant.preview` | class-level `user-scoped`, no per-route decorator needed (state it explicitly if other GET routes do) |
| `@Post('accountant/mark-sent.json')` | `@CurrentOwner()` and `@StrictBody() dto: MarkChargesDto` | `accountant.markSent` | `@CachePolicy(CacheClass.Never)` |
| `@Post('accountant/mark-unsent.json')` | `@CurrentOwner()` and `@StrictBody() dto: MarkChargesDto` | `accountant.markUnsent` | `@CachePolicy(CacheClass.Never)` |

- **Status codes.** The POST routes answer `200`, not `201`, so add `@HttpCode(200)`.
- **Service access.** Each handler gets the service through
  `const { accountant } = await this.loader.services();`.
- **Wiring.**
  - `bank.module.ts`: add `AccountantService` and `AccountantChargesQuery` to `providers`, export
    `AccountantService`, and re-export the class for the dynamic import.
  - `bank-module.loader.ts`: add `accountant: AccountantService` (type-only import) to
    `BankServices` and resolve it in `services()`.
  - `bank-routes.module.ts`: add `AccountantController` to `controllers`.
  - `tests/support/build-bank-test-app.ts`: add whatever the new service needs (for example a
    `query` on the fake manager, or the mocked query module).

## Files to Change
- `backend/src/bank/accountant.controller.ts` — new resident controller
- `backend/src/bank/bank.module.ts` — register and export the service and query
- `backend/src/bank/bank-module.loader.ts` — expose `accountant`
- `backend/src/bank/bank-routes.module.ts` — register the controller
- `backend/src/bank/tests/support/build-bank-test-app.ts` — test harness wiring
