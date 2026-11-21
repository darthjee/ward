# Split OwnerScope from OwnerContext

Keep the role required wherever an organization `OwnerContext` exists. Code that derives an owner
from a record (with no caller and no role) uses `OwnerScope` instead.

In `core/owner-context.ts`:

- `export type OwnerScope = { kind: 'user'; userId: number } | { kind: 'organization';
  organizationId: number };`. Document it as identifying only the data owner.
- `export type OwnerContext = { kind: 'user'; userId: number } | { kind: 'organization';
  organizationId: number; role: OrgRole };`. Document it as resolved per request by
  `OwnerContextGuard`, from the DB membership only. The personal variant counts as `owner`.
- Add `ownerRole(ctx: OwnerContext): OrgRole`, which returns `'owner'` for `kind: 'user'` and
  `ctx.role` otherwise. The guard, the transaction rule and the specs share it.
- Retype `ownerWhere` and `ownerSqlWhere` (and their `@param` tags) to take `OwnerScope`.

Retype the record-derived and pure scoping helpers to `OwnerScope`:

- `bank/account-fields.ts` `accountOwnerWhere(owner: OwnerScope)` and its JSDoc;
- `bank/account-types/provider-bill-rescale.ts` `ownerOf(account): OwnerScope`. Fix the
  `@returns` doc ("as the routes would resolve it" becomes "the data owner scope").

Leave service signatures that receive the request context (`AccountService`, `BillService`,
`TransactionService`, `BillPaymentWriter`, and so on) on `OwnerContext`. Where they only forward
to the helpers above, the structural assignability handles it. Only `TransactionService.update`
reads the role.

Update the test fixtures that build an organization `OwnerContext`:

- `bank/tests/account.test-support.ts` `ORGANIZATION`: add `role: 'owner'`.
- `core/tests/owner-context.guard.spec.ts`, `core/tests/current-owner.decorator.spec.ts` and
  `core/tests/cache-invalidation.interceptor.spec.ts`: add `role`.
- `core/tests/owner-context.spec.ts` and
  `database/tests/integration/accountant-charges.integration-spec.ts` (`ALICE_ORG`): type them
  as `OwnerScope`, with no role.
- Add a unit spec for `ownerRole`.

`core/cache-invalidation.interceptor.ts` reads only `kind` and `organizationId`, so it does not
change.

## Files to Change
- `backend/src/core/owner-context.ts` — `OwnerScope`, `OwnerContext` with `role`, `ownerRole`, retyped helpers, docs.
- `backend/src/bank/account-fields.ts` — `accountOwnerWhere(OwnerScope)`.
- `backend/src/bank/account-types/provider-bill-rescale.ts` — `ownerOf` returns `OwnerScope`.
- `backend/src/bank/tests/account.test-support.ts` — `ORGANIZATION` gains `role`.
- `backend/src/core/tests/owner-context.spec.ts` — `OwnerScope` typing; `ownerRole` cases.
- `backend/src/core/tests/current-owner.decorator.spec.ts` — add `role`.
- `backend/src/core/tests/cache-invalidation.interceptor.spec.ts` — add `role`.
- `backend/src/database/tests/integration/accountant-charges.integration-spec.ts` — `OwnerScope` typing.
