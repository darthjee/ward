# Plan: Organization permissions: backend role enforcement

Issue: [143-organization-permissions-backend-role-enforcement.md](../../issues/143-organization-permissions-backend-role-enforcement.md)

## Overview

Add role enforcement for organization-scoped writes:

- `OrgRole`, `hasMinRole` and a uniform 403 factory live in `core`.
- `OwnerScope` (who owns the data) is split from `OwnerContext` (the resolved request, which
  carries `role` for organizations).
- The membership port returns the role (`findRole`), and `OwnerContextGuard` enforces
  `@MinOrgRole` after the uniform 404.
- A coverage spec keeps owner-scoped writes closed by default.
- Two rules sit outside the guard: the payment-generated transaction rule (service level) and
  the rename rule (`OrganizationService#rename`).

## Context

Current state, as explored. Paths are under `backend/src/`.

- `core/owner-context.ts`: `OwnerContext = { kind: 'user'; userId } | { kind: 'organization';
  organizationId }`, plus `ownerWhere(ctx)` and `ownerSqlWhere(ctx, alias)`.
- `core/owner-context.guard.ts`:
  - `OwnerContextGuard` is the last global `APP_GUARD` (`app.module.ts`: Origin → Jwt → Admin →
    OwnerContext).
  - It acts only when `IS_OWNER_SCOPED_KEY` is set (through `readBooleanMetadata`, which reads
    handler then class).
  - `#resolve` throws `ownerNotFound()` when there is no user, parses `:orgId` with
    `parseOrgId`, and calls `lookup.isMember(user.sub, orgId)`. The result goes to
    `request.ownerContext`, which is typed in `types/express.d.ts`.
- `core/organization-membership-lookup.ts`: `ORGANIZATION_MEMBERSHIP_LOOKUP` and
  `OrganizationMembershipLookup.isMember(userId, orgId): Promise<boolean>`. `auth/auth.module.ts`
  binds it with `useExisting: OrganizationService`.
- `core/owner-scoped.decorator.ts`: `OwnerScopedController(path)` mounts `[path,
  'orgs/:orgId/' + path]` and applies `OwnerScoped()`, `CachePolicy(UserScoped)` and
  `InvalidatesOwner()`. All bank controllers use `@OwnerScopedController('bank')`.
- `core/cache-policy.decorator.ts` is the `SetMetadata` decorator pattern to copy.
- `core/tests/cache-policy.coverage.spec.ts`:
  - It walks `*.controller.ts`, imports each file and builds `RouteEntry { httpMethod,
    ownerScoped }`.
  - `READ_METHODS = [GET, HEAD]`.
  - Fixture controllers prove that each check flags violations.
  - `KNOWN_CONTROLLERS` lacks `ProviderBillsController` and `ProviderBillPaymentsController`.
- `auth/entities/organization-membership.entity.ts`: the `MembershipRole` const object and type
  (`owner`/`admin`/`user`). The doc says "Stored but not enforced".
- `auth/organization.service.ts`:
  - `isMember` calls `membershipRepository.existsBy({ organizationId, userId })`.
  - `rename` calls `findMembership` (membership + organization) → `ownerNotFound()` → save.
    Its doc says "any role; last write wins".
- `auth/organization.controller.ts`: `PATCH orgs/:orgId.json` takes `@StrictBody()` first
  (400 → 404).
- All 22 bank write routes from the issue table exist, with no extras, in:
  - `bank/accounts.controller.ts`
  - `bank/transactions.controller.ts`
  - `bank/bills.controller.ts`
  - `bank/provider-bills.controller.ts`
  - `bank/bill-payments.controller.ts`
  - `bank/provider-bill-payments.controller.ts`
  - `bank/accountant.controller.ts`

  `settings.controller.ts` and `calendar.controller.ts` are read-only.
- `bank/transaction.service.ts` `update(owner, accountId, transactionId, dto)`:
  - `#writableAccount` → `accounts.findOwned(owner, …)` (404 if not found, 409 if archived).
  - Then `#findTransaction(account, id)` (404 if not found).
  - The service has no `BillPayment` repository yet. The entity is already in `forFeature`.
- `bank/entities/bill-payment.entity.ts`: `paymentTransactionId`, `withdrawalTransactionId` and
  `chargeTransactionId` are nullable ints. Each has an FK to `bank_transactions`, so each is
  indexed.
- `bank/account-types/provider-bill-rescale.ts` `ownerOf(account)` is the only production code
  that derives an owner from a record. It feeds `accountOwnerWhere` (`bank/account-fields.ts`).
- The global `HttpExceptionFilter` (`core/http-exception.filter.ts`) rewrites every exception to
  `{ error: { code, message }, statusCode, timestamp }`. `ErrorCodes.FORBIDDEN` already exists.
- Test harnesses:
  - `bank/tests/support/build-bank-test-app.ts`:
    - `FakeMembershipLookup` with `MEMBERSHIPS = new Set(['7:3', '8:4'])`;
    - `StubUserGuard` reads `x-test-user`;
    - `ALICE`, `BOB`, `ALICE_ORG` and `BOB_ORG`.
  - `bank/tests/support/owner-matrix.ts`.
  - `bank/tests/support/in-memory-bank-repos.ts`: `existsBy` accepts a single `Where` only.
  - `auth/tests/support/build-auth-test-app.ts` exposes `membershipRepo.rows`.
  - `auth/tests/organization.controller.e2e-test-support.ts`.

## Steps

- [01 — OrgRole, hasMinRole and the 403 factory in core](backend/01-org-role-core.md)
- [02 — Split OwnerScope from OwnerContext](backend/02-owner-scope-split.md)
- [03 — Lookup port: findRole replaces isMember](backend/03-find-role-port.md)
- [04 — @MinOrgRole and guard enforcement](backend/04-min-org-role-guard.md)
- [05 — Coverage spec for undeclared owner-scoped writes](backend/05-coverage-spec.md)
- [06 — Declare roles on bank write routes and the per-role e2e matrix](backend/06-bank-route-roles.md)
- [07 — Payment-generated transaction rule](backend/07-payment-generated-transaction.md)
- [08 — Rename requires admin](backend/08-rename-role.md)

## CI Checks

- `backend`:
  - `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
  - `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
  - `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
  - `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)

## Notes

- **403 wire shape (decision).** The factory is `orgRoleForbidden()`, which returns
  `new ForbiddenException()` (Nest's default `{ statusCode: 403, message: 'Forbidden', error:
  'Forbidden' }`).
  - The global filter serialises it as `{ error: { code: 'FORBIDDEN', message: 'Forbidden' },
    statusCode: 403 }` plus `timestamp`. That is exactly how the uniform 404 already works.
  - The e2e specs assert this filtered shape through a shared `UNIFORM_403` constant, next to
    `UNIFORM_404`. Do not change the filter.
  - The body names neither the resource nor the required role.
- **Check order.**
  - Owner-scoped routes: 404 for a non-member or a malformed `:orgId`, then 403 for the route
    role, then the handler.
  - Transaction `PATCH` as `user`: route role passes → 404 for the account, 409 if archived,
    404 for the transaction → payment-generated 403 → body validation and the update. The 409
    before the 403 is accepted: the account state is not a secret from a member who can read
    it.
  - Rename: 400 body → 404 membership → 403 role.
- **No caching, no admin bypass.** Do not read `AdminGuard`'s `is_admin` in the role check. The
  role comes only from the DB membership.
- **`OwnerContext` assignability.** The organization variant of `OwnerContext` has an extra
  `role` field, so it stays assignable to `OwnerScope`. Callers that pass `OwnerContext` into
  helpers that now take `OwnerScope` need no change.
- **Fake repo.** The payment-generated check uses an `OR` over three columns. Extend the
  in-memory bank repo's `existsBy`/`exists` to accept `Where[]` (any match), the same way `find`
  already does.
- **File size.** `transaction.service.ts` is 195 lines. If adding the check pushes it toward the
  300-line cap, put the `EXISTS` query in a small `PaymentGeneratedTransactionQuery` provider.
- **Production behaviour is unchanged.** Every existing organization has a single `owner`.
