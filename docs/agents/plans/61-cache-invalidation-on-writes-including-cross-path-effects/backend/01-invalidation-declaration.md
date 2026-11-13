# Add the invalidation declaration

Add metadata that lets every non-GET route declare which cached GET paths it invalidates. It sits
next to `@CachePolicy`.

1. Create `backend/src/core/cache-invalidation.decorator.ts` with:
   - an `INVALIDATION_KEY` metadata key;
   - a declaration type, a discriminated union:
     - `{ kind: 'owner' }`: the owner's base prefix, resolved at request time;
     - `{ kind: 'paths', build: (request) => string[] }`: explicit paths computed from the request,
       such as the parsed `orgId`;
     - `{ kind: 'none' }`;
   - decorators `InvalidatesOwner()`, `InvalidatesPaths(build)` and `NoCacheInvalidation()`, each
     a `SetMetadata(INVALIDATION_KEY, …)`. Exact names are up to the implementer, but keep them
     self-describing.
2. In `backend/src/core/owner-scoped.decorator.ts`, add `InvalidatesOwner()` to
   `OwnerScopedController`'s `applyDecorators(...)`. The class-level metadata then becomes the
   default for every owner-scoped route, GETs included; the interceptor ignores GET and HEAD.
3. In `backend/src/auth/organization.controller.ts`:
   - `create` (POST `/orgs.json`): `InvalidatesPaths(() => ['/orgs.json'])`.
   - `rename` (PATCH `/orgs/:orgId.json`): `InvalidatesPaths(req => ['/orgs.json',
     `/orgs/${id}.json`])`.
     - Parse the id strictly as a positive integer, the same way `OwnerContextGuard` does.
     - If parsing fails, return only `/orgs.json`. That case can't reach a 2xx anyway.
     - Never emit `/orgs`.
4. Add a class-level `NoCacheInvalidation()` to:
   - `backend/src/auth/auth.controller.ts`;
   - `backend/src/auth/authorization-request.controller.ts`;
   - `backend/src/auth/admin.controller.ts`.

   None of these has cached GETs.

## Files to Change

- `backend/src/core/cache-invalidation.decorator.ts`: new key, type and decorators.
- `backend/src/core/owner-scoped.decorator.ts`: add the owner default.
- `backend/src/auth/organization.controller.ts`: declarations on `create` and `rename`.
- `backend/src/auth/auth.controller.ts`, `backend/src/auth/authorization-request.controller.ts`,
  `backend/src/auth/admin.controller.ts`: class-level "none".
