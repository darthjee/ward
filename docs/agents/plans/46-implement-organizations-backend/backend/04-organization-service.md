# OrganizationService, DTOs, serializer and module wiring
- **`backend/src/auth/organization.service.ts`**: `OrganizationService implements OrganizationMembershipLookup`.
  - `isMember(userId, orgId)` does one `findOne` / `exist` on the unique
    `(organizationId, userId)` key, without checking that the organization exists first.
  - `findMembership(userId, orgId)` returns the membership and organization, or `null`.
  - `listForUser(userId)` returns `{ organization, role }[]` with a stable order (e.g. by id).
  - `create(userId, name)` saves the organization and an `owner` membership in one transaction
    (`dataSource.transaction` or a repo-level equivalent that the in-memory fakes can handle).
  - `rename(userId, orgId, name)` throws the uniform 404 for a non-member.
  - It never logs names. There is no admin bypass and no caching.
- **DTOs** in `backend/src/auth/dto/`: an `OrganizationNameDto`, used for both POST and PATCH
  (or create/update aliases), with `name`:
  - `@Transform` that trims strings and leaves anything else untouched;
  - `@IsString()`;
  - `@IsNotEmpty()`;
  - a custom code-point length check (`[...value].length <= 255`), not `@MaxLength`, because
    validator.js discounts variation selectors;
  - a control-character check (`@Matches(/^[^\p{Cc}]*$/u)`).

  A missing `name` on PATCH → 400.
- **Serializer**: add `serializeOrganization(org, role)` to `backend/src/auth/auth-response.ts`
  (or a new `organization-response.ts`). It returns exactly
  `{ id, name, role, created_at, updated_at }`, with JSDoc like `serializeUser()`.
- **`backend/src/auth/auth.module.ts`**:
  - add both entities to `forFeature`;
  - add `OrganizationService` and
    `{ provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useExisting: OrganizationService }`, and export
    both;
  - add `OrganizationController` (step 05).
- **`backend/src/auth/tests/support/build-auth-test-app.ts`**:
  - override `getRepositoryToken(Organization)` and `getRepositoryToken(OrganizationMembership)`
    with in-memory repos, otherwise every existing auth e2e breaks;
  - return the repos;
  - add an option to install `OwnerContextGuard` as a global guard.

  If `create` uses a transaction, provide a fake for it.
- **Unit tests**:
  - service: create makes an owner, list, rename, `isMember` true/false, non-member rename → 404;
  - DTO: trim, empty, whitespace-only, 255 vs 256 code points (including astral characters),
    `\u0000`, a non-string;
  - serializer: exact key set.

## Files to Change
- `backend/src/auth/organization.service.ts` — new
- `backend/src/auth/dto/organization-name.dto.ts` — new
- `backend/src/auth/auth-response.ts` (or `organization-response.ts`) — `serializeOrganization`
- `backend/src/auth/auth.module.ts` — entities, service, port provider and exports
- `backend/src/auth/tests/support/build-auth-test-app.ts` — repo overrides and guard option
- `backend/src/auth/tests/organization.service.spec.ts`, `organization-name.dto.spec.ts`, `organization-response.spec.ts` — unit tests
