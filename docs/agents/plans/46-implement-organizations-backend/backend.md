# Plan: Implement organizations — backend

Issue: [46-implement-organizations-backend.md](../../issues/46-implement-organizations-backend.md)

## Overview
Build organizations in `auth` and the owner-context machinery in `core`, as specified in
`docs/agents/specs/auth/organizations.md` and the issue. `core` never imports `auth`: the
membership check goes through the `ORGANIZATION_MEMBERSHIP_LOOKUP` port, which
`OrganizationService` implements and `AuthModule` exports. This is the same pattern as
`SESSION_LOOKUP`.

## Context
- Backend routes have **no `/api` prefix**: there is no `setGlobalPrefix`, and Tent forwards
  `*.json` as-is. `/api/orgs.json` in the spec is the external URL, so the backend serves
  `orgs.json` and `orgs/:orgId.json`, and `@OwnerScopedController('bank')` mounts
  `['bank', 'orgs/:orgId/bank']`. Tests call `/orgs.json`.
- Current `APP_GUARD` order is `OriginGuard`, `JwtGuard`, `AdminGuard`. `OwnerContextGuard`
  becomes the fourth.
- Global pipe (`main.ts`): `new ValidationPipe({ whitelist: true, transform: true })`. It stays
  unchanged.
- Uniform error body: `{ error: { code, message }, statusCode, timestamp }`. Compare 404s
  without `timestamp`.

## Decisions taken while planning (raise both on the issue)
1. **Strict validation needs a custom parameter decorator.** Nest runs the global pipe before
   controller pipes, and the global pipe already strips unknown keys. A controller-level
   `@UsePipes(StrictValidationPipe)` would therefore never see `role` / `organizationId` and
   never answer 400. Instead:
   - add a `@StrictBody()` parameter decorator (`createParamDecorator`, with
     `StrictValidationPipe` bound to it). The global pipe skips custom parameters because
     `validateCustomDecorators` is false by default;
   - org handlers and owner-scoped handlers use `@StrictBody()` instead of `@Body()`;
   - `@OwnerScopedController` still bundles the path, the owner-scoped metadata and
     `@CachePolicy(UserScoped)`;
   - a static coverage test fails if any owner-scoped or org handler uses a plain `@Body()`.

   That test is what keeps mounting, scoping, cache class and strict validation from being
   separated.
2. **Table names follow the `auth_` prefix convention**: `auth_organizations` and
   `auth_organization_memberships`, with FKs to `auth_users`. Every existing table and
   `architecture/modular-pattern.md` use the `auth_` prefix, and the migration round-trip spec
   only checks tables starting with `auth_`. The spec's `organizations` / `users` are logical
   names. Columns stay as specified.

## Steps

- [01 — Core primitives: OwnerContext, ownerWhere, parseOrgId, uniform 404, strict validation, lookup port](backend/01-core-primitives.md)
- [02 — Core owner-scoped decorator, OwnerContextGuard and @CurrentOwner](backend/02-owner-scoped-guard.md)
- [03 — Entities, migration and test registries](backend/03-entities-migration.md)
- [04 — OrganizationService, DTOs, serializer and module wiring](backend/04-organization-service.md)
- [05 — OrganizationController and its e2e tests](backend/05-organization-controller.md)
- [06 — Owner-scoped e2e tests with a test-only controller](backend/06-owner-scoped-e2e.md)

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Never log organization names, only ids.
- Never type `:orgId` as `number`: with `transform: true`, the global pipe would turn `'1e3'`
  into 1000. Take it as a `string` and call `parseOrgId()`. Never use `ParseIntPipe`, which
  answers 400.
- Guard 404s carry no cache headers, because guards run before `CachePolicyInterceptor`. This is
  acceptable because Tent stores only 2xx responses.
- Out of scope:
  - frontend (#47);
  - record-level owner tests (#48);
  - permanent docs (#58);
  - per-user caching (#60);
  - cache invalidation (#61);
  - joining, leaving, closing, role permissions and a creation rate limit.
- Lint limits: max-lines 300 and complexity 10, and `sort-class-members` is an error. Split
  e2e spec files to stay within them.
