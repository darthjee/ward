# Owner-scoped e2e tests with a test-only controller
Prove the owner-context machinery end to end, without any test-only entity or table.

- **Test-only controller** under `backend/src/auth/tests/` (e.g. in
  `owner-scoped.e2e-test-support.ts`), never registered in the app:
  - `@OwnerScopedController('widgets')` with `@Get('owner.json')`, which returns the
    `@CurrentOwner()` context as JSON;
  - a `@Post('echo.json')` that takes a `@StrictBody()` DTO.

  Register it through `buildAuthTestApp({ controllers: [...], ownerContextGuard: true })`.
- **e2e spec** `backend/src/auth/tests/owner-scoped.e2e-spec.ts`:
  - `/widgets/owner.json` → `{ kind: 'user', userId: <jwt sub> }`;
  - `/orgs/:orgId/widgets/owner.json` for a member → `{ kind: 'organization', organizationId }`;
  - identical 404 bodies for an unknown, malformed (`abc`, `007`, `-1`, `1.5`, `1e3`,
    `99999999999`) and non-member `:orgId`;
  - a global admin who is not a member → 404;
  - both prefixes send `X-Skip-Cache` (user-scoped);
  - unknown body fields on the echo route → 400 under both prefixes.
- **"Works for a lazy module without importing `auth`"**: a core-level spec
  (`backend/src/core/tests/owner-scoped.module.e2e-spec.ts`) builds a minimal test module
  - with a controller declared through `@OwnerScopedController`;
  - with `OwnerContextGuard` as `APP_GUARD`, after a stub that sets `request.user`;
  - with a fake `ORGANIZATION_MEMBERSHIP_LOOKUP` provider;
  - that imports nothing from `backend/src/auth/`.

  It shows the mechanism depends only on `core` and the port token. Lazy modules register their
  controllers at boot, so this covers that case too. The spec states this in a comment.
- Run the full suite, the integration suite and lint (see CI Checks in `backend.md`).

## Files to Change
- `backend/src/auth/tests/owner-scoped.e2e-test-support.ts` — test-only owner-scoped controller and DTO
- `backend/src/auth/tests/owner-scoped.e2e-spec.ts` — dual-prefix e2e tests
- `backend/src/core/tests/owner-scoped.module.e2e-spec.ts` — core-only mechanism test with a fake lookup
