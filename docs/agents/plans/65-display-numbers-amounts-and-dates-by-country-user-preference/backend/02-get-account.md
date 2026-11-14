# `GET /auth/account.json`

Add `AccountService#getAccount(userId): Promise<AccountSummary>` loading the caller's row
(reuse `#loadUser`) and returning `{ username, email, locale }` — nothing else. Extend
`AccountSummary` in `user-update.service.ts` with `locale: UserLocale | null` (step 03 relies on
the same shape for the PATCH response).

Add `@Get('account.json') getAccount(@CurrentUser() user: AccessTokenPayload)` to
`AuthController`, delegating to `accountService.getAccount(user.sub)`. No `@Public()`: the
default `JwtGuard` and session gate apply. It inherits the controller-level
`@CachePolicy(CacheClass.Never)` and `@NoCacheInvalidation()`; do not add a narrower class.

Specs:

- `account.service.spec.ts` — returns exactly `{ username, email, locale }` for the given id,
  `locale: null` for a user without a preference.
- `auth.controller.spec.ts` — delegates with `user.sub`.
- `auth.controller.account.e2e-spec.ts` — logged-in caller gets `200` with its own fields and
  no `id`/`isAdmin`/`status`/`passwordDigest`; no cookie → `401 Missing access token`; a
  pending user → gate `401`; response has `X-Skip-Cache: true`.
- `core/tests/cache-policy.coverage.spec.ts` must keep passing (inherited policy).

## Files to Change

- `backend/src/auth/account.service.ts` — `getAccount`
- `backend/src/auth/user-update.service.ts` — `AccountSummary` gains `locale`
- `backend/src/auth/auth.controller.ts` — `@Get('account.json')`
- `backend/src/auth/tests/account.service.spec.ts`
- `backend/src/auth/tests/auth.controller.spec.ts`
- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts`
