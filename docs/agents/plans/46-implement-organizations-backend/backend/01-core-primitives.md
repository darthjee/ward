# Core primitives: OwnerContext, ownerWhere, parseOrgId, uniform 404, strict validation, lookup port
Add the dependency-free building blocks to `backend/src/core/`, each with JSDoc and unit tests.

- **`organization-membership-lookup.ts`**:
  - `export const ORGANIZATION_MEMBERSHIP_LOOKUP = Symbol('ORGANIZATION_MEMBERSHIP_LOOKUP')`;
  - `interface OrganizationMembershipLookup { isMember(userId: number, orgId: number): Promise<boolean> }`.

  Mirror `session-lookup.ts`.
- **`owner-context.ts`**:
  - `type OwnerContext = { kind: 'user'; userId: number } | { kind: 'organization'; organizationId: number }`;
  - `ownerWhere(ctx)`, a pure helper that returns `{ userId: X, organizationId: IsNull() }` or
    `{ userId: IsNull(), organizationId: Y }` (TypeORM `IsNull`).
- **`parse-org-id.ts`**: `parseOrgId(raw: unknown): number`.
  - Accept only strings matching `^[1-9][0-9]*$` with a value ≤ 2147483647.
  - Throw the uniform 404 otherwise: `abc`, `007`, `-1`, `1.5`, `1e3`, `99999999999`, `0`, the
    empty string, and `2147483648`.
- **Uniform 404**: a single factory, e.g. `ownerNotFound()` returning `new NotFoundException()`,
  in `owner-not-found.ts` or inside `parse-org-id.ts`. The guard, `parseOrgId()` and the org
  service all use it, so every body is byte-identical apart from `timestamp`.
- **`strict-validation.pipe.ts`**: `StrictValidationPipe extends ValidationPipe` with
  `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
  - **`StrictBody()`** is a parameter decorator built with `createParamDecorator`, which returns
    `request.body` and has `StrictValidationPipe` bound to it (`StrictBody()` →
    `createParamDecorator(...)(new StrictValidationPipe())` or the equivalent).
  - The pipe has to get the parameter's metatype so it can validate against the DTO. Verify
    that custom-decorator metadata carries `metatype` to the pipe, and confirm that the global
    pipe leaves custom parameters alone (`validateCustomDecorators` is false by default).
  - Leave the global pipe in `main.ts` unchanged.
- **Unit tests** under `backend/src/core/tests/`:
  - `parseOrgId()`: every valid and malformed case, including the max int boundary;
  - `ownerWhere()`: both kinds;
  - `StrictValidationPipe` / `@StrictBody()`: an unknown field gives 400, a valid DTO passes and
    gets transformed;
  - the 404 factory body.

## Files to Change
- `backend/src/core/organization-membership-lookup.ts` — new port
- `backend/src/core/owner-context.ts` — `OwnerContext` type and `ownerWhere()`
- `backend/src/core/parse-org-id.ts` — strict `:orgId` parser and the uniform 404 factory
- `backend/src/core/strict-validation.pipe.ts` — `StrictValidationPipe` and `@StrictBody()`
- `backend/src/core/tests/parse-org-id.spec.ts`, `owner-context.spec.ts`, `strict-validation.pipe.spec.ts` — unit tests
