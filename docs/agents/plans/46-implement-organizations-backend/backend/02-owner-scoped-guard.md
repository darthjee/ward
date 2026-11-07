# Core owner-scoped decorator, OwnerContextGuard and @CurrentOwner
Add the mechanism that resolves the owner of every request to an owner-scoped route.

- **`owner-scoped.decorator.ts`**:
  - `IS_OWNER_SCOPED_KEY` and `OwnerScoped()` (`SetMetadata`, like `@AdminOnly()`);
  - `OwnerScopedController(path: string)` is an `applyDecorators(...)` of:
    - `Controller([path, \`orgs/:orgId/${path}\`])`;
    - `OwnerScoped()`;
    - `CachePolicy(CacheClass.UserScoped)`.

    Its JSDoc must say that handlers take bodies only through `@StrictBody()`.
- **`owner-context.guard.ts`**: the global `OwnerContextGuard`.
  - It reads the metadata with `readBooleanMetadata` and does nothing without it.
  - It throws the uniform 404 when `request.user` is missing (e.g. combined with `@Public()`).
  - Without `request.params.orgId`, it sets `request.ownerContext = { kind: 'user', userId: user.sub }`.
  - With `orgId`, it runs `parseOrgId()`, then
    `await lookup.isMember(user.sub, orgId)` (injected with
    `@Inject(ORGANIZATION_MEMBERSHIP_LOOKUP)`), and sets the organization context or throws the
    uniform 404.
  - No admin bypass and no caching. Never log names.
- **`current-owner.decorator.ts`**: `getCurrentOwner` (exported for tests) plus
  `CurrentOwner = createParamDecorator(getCurrentOwner)`, mirroring `current-user.decorator.ts`.
  It throws if `ownerContext` is missing.
- **`backend/src/types/express.d.ts`**: add `ownerContext?: OwnerContext`.
- **`backend/src/app.module.ts`**: register `OwnerContextGuard` as the fourth `APP_GUARD`, after
  `AdminGuard`, and update the class JSDoc about guard order. The token is supplied by
  `AuthModule`'s export, see step 04. Because `AuthModule` is imported by `AppModule`, the
  global guard can resolve it.
- **Unit tests**:
  - guard: no metadata → passes; personal → user context; org member → org context;
    non-member, malformed and unknown ids → identical 404s; admin non-member → 404; missing
    user → 404;
  - `getCurrentOwner`;
  - `OwnerScopedController` metadata: both paths, the owner-scoped flag, `UserScoped`.
- **`backend/src/core/tests/cache-policy.coverage.spec.ts`**: add two checks.
  - Every handler of a controller or handler with owner-scoped metadata resolves (handler ??
    class) to a cache class other than `Public`.
  - Owner-scoped handlers and `OrganizationController` handlers never use a plain `@Body()`.
    Inspect `ROUTE_ARGS_METADATA` for `RouteParamtypes.BODY`.

  Also add `OrganizationController` to `KNOWN_CONTROLLERS` (step 05).

## Files to Change
- `backend/src/core/owner-scoped.decorator.ts` — new
- `backend/src/core/owner-context.guard.ts` — new
- `backend/src/core/current-owner.decorator.ts` — new
- `backend/src/types/express.d.ts` — `ownerContext` on `Request`
- `backend/src/app.module.ts` — fourth `APP_GUARD`
- `backend/src/core/tests/owner-context.guard.spec.ts`, `current-owner.decorator.spec.ts`, `owner-scoped.decorator.spec.ts` — unit tests
- `backend/src/core/tests/cache-policy.coverage.spec.ts` — never-public and no-plain-`@Body()` checks
