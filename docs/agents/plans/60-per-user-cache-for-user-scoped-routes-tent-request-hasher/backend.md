# Backend Plan: Per-user cache for user-scoped routes (Tent request_hasher)

Main plan: [plan.md](plan.md)

## Shared contracts

The backend **produces** these response headers, set only by the global `CachePolicyInterceptor`
and never by hand:

| Effective class | `X-Cache-Allow` | `X-Skip-Cache` | `Cache-Control` |
|---|---|---|---|
| `public`, GET/HEAD | `true` | *(absent)* | `public, max-age=10` |
| `user-scoped`, GET/HEAD | `true` | *(absent)* | `private, no-store` |
| `never` | *(absent)* | `true` | `no-store` |
| any class, method other than GET/HEAD | *(absent)* | `true` | `no-store` |
| no class declared | *(absent)* | *(absent)* | *(absent)* |

The backend can rely on the proxy forwarding an `X-Skip-Cache` **request** header for expired
tokens. The backend must keep ignoring request-side `X-Skip-Cache`.

**Do not merge before #61 is merged.**

## Implementation Steps

### Step 1 — Emit `X-Cache-Allow` from the interceptor

- `backend/src/core/cache-class.ts`:
  - add `export const CACHE_ALLOW_HEADER = 'X-Cache-Allow'`;
  - reword the doc comments on `CacheClass.UserScoped` ("never shared-cached until Tent has a
    per-user cache" becomes "cached per caller by the proxy") and on `SKIP_CACHE_HEADER`.
- `backend/src/core/cache-policy.interceptor.ts`:
  - in `#applyHeaders`, an effective `Public` or `UserScoped` sets `X-Cache-Allow: true`;
  - an effective `Never` (including any non-GET/HEAD, via `#effectiveClass`) sets
    `X-Skip-Cache: true`;
  - leave the `Cache-Control` map unchanged;
  - with no class declared, set no headers (unchanged);
  - update the JSDoc.
- `backend/src/core/tests/cache-policy.interceptor.spec.ts`:
  - unit block:
    - public GET/HEAD sends `X-Cache-Allow` and no `X-Skip-Cache`;
    - user-scoped GET gives exactly `[[X-Cache-Allow,'true'],['Cache-Control','private, no-store']]`;
    - public/user-scoped writes and never GET give exactly
      `[[X-Skip-Cache,'true'],['Cache-Control','no-store']]` (no `X-Cache-Allow`);
  - wired-globally block: assert `x-cache-allow` on the public override, and its absence on the
    never routes, the forced-never POST and the undeclared routes.

### Step 2 — Align the other specs and comments

- Flip every **GET** assertion on a user-scoped route from `x-skip-cache: 'true'` to
  `x-cache-allow: 'true'`. Also assert `x-skip-cache` is undefined, and keep
  `cache-control: private, no-store`. Write-method assertions stay `x-skip-cache`. Check the
  method of each one:
  - `backend/src/auth/tests/owner-scoped.e2e-spec.ts` (~69, ~88)
  - `backend/src/auth/tests/organization.controller.read.e2e-spec.ts` (~62, ~82; ~103 stays)
  - `backend/src/core/tests/owner-scoped.module.e2e-spec.ts` (~114)
  - `backend/src/bank/tests/`:
    - `accounts` (~406)
    - `calendar` (~231)
    - `settings` (~51)
    - `bill-payments` (~486)
    - `debt-accounts` (~476)
    - `accountant` (~226, ~415)
    - `provider-expense-accounts` (~522)
    - `investment-accounts` (~495)
    - `transactions` (~288)
    - `bills` (~103, ~189)
  - `grep -rn "x-skip-cache" backend/src` to catch any the list missed.
- The `never`-class specs stay unchanged (auth, recovery, refresh-logout, account, admin,
  authorization-request, organization create, health).
- `backend/src/core/tests/cache-policy.coverage.spec.ts`: no functional change. Update the
  header comment: an undeclared route is no longer silently shared-cached; it is silently
  *not* cached, and gets no browser `Cache-Control`. Keep the "owner-scoped never `public`"
  rule.
- Comments only:
  - `backend/src/auth/auth-response.ts` (~20);
  - `backend/src/auth/tests/support/build-auth-test-app.ts` (~59).

## Files to Change

- `backend/src/core/cache-class.ts`: new `CACHE_ALLOW_HEADER`, comment updates
- `backend/src/core/cache-policy.interceptor.ts`: header selection
- `backend/src/core/tests/cache-policy.interceptor.spec.ts`: new contract
- `backend/src/core/tests/cache-policy.coverage.spec.ts`: header comment
- The e2e specs listed in Step 2: flip the GET assertions
- `backend/src/auth/auth-response.ts`, `backend/src/auth/tests/support/build-auth-test-app.ts`:
  comments

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` if any integration spec
  asserts cache headers (CI job: `backend_integration`)

## Notes

- `@OwnerScopedController` (`backend/src/core/owner-scoped.decorator.ts`) and
  `OrganizationController` already declare `UserScoped`, so the switch is centralized in the
  interceptor and no decorator changes.
- No CORS change is needed: `cors-config.ts` exposes no headers, and these headers are for the
  proxy only.
