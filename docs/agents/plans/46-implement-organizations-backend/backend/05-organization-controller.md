# OrganizationController and its e2e tests
- **`backend/src/auth/organization.controller.ts`**: `@Controller()` with class-level
  `@CachePolicy(CacheClass.Never)`. It is not owner-scoped.
  - `@Get('orgs.json')` (`@CachePolicy(UserScoped)`) lists the caller's organizations:
    `serializeOrganization` for each.
  - `@Post('orgs.json')` takes `@StrictBody() dto` and returns the created organization with
    role `owner`, status 201.
  - `@Get('orgs/:orgId.json')` (`UserScoped`) and `@Patch('orgs/:orgId.json')` (`@StrictBody()`)
    take `@Param('orgId') raw: string`, call `parseOrgId(raw)`, then look up the membership
    through `OrganizationService`. Any miss gives the uniform 404.
  - It gets the caller from `@CurrentUser()` (`caller.sub`).
  - It never logs names.
- Add it to `KNOWN_CONTROLLERS` in `cache-policy.coverage.spec.ts`.
- **e2e specs** (`backend/src/auth/tests/organization.controller*.e2e-spec.ts`, using
  `useTestApp` / `buildAuthTestApp`, `loginCookie`, `registerUser`). Split the files to stay
  under max-lines. Cover:
  - registration creates no organization and no membership;
  - POST makes the requester `owner`; `role` / `organizationId` in the body → 400;
  - name is trimmed; empty, whitespace-only, 256 characters and `\u0000` → 400; exactly 255
    characters → 201;
  - PATCH renames; PATCH without `name` → 400; unknown fields → 400;
  - GET list returns only the caller's organizations, with their role;
  - GET / PATCH return identical 404 bodies (ignoring `timestamp`) for an unknown id, every
    malformed id (`abc`, `007`, `-1`, `1.5`, `1e3`, `99999999999`) and a non-member;
  - a global admin who is not a member → 404;
  - responses have exactly `id`, `name`, `role`, `created_at`, `updated_at`;
  - GETs send `X-Skip-Cache` with user-scoped `Cache-Control`; POST / PATCH are `never`;
  - unauthenticated requests → 401.

## Files to Change
- `backend/src/auth/organization.controller.ts` — new
- `backend/src/auth/auth.module.ts` — register the controller
- `backend/src/core/tests/cache-policy.coverage.spec.ts` — add to `KNOWN_CONTROLLERS`
- `backend/src/auth/tests/organization.controller.e2e-spec.ts` (and split siblings) — e2e tests
