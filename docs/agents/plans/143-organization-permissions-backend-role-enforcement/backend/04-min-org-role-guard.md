# @MinOrgRole and guard enforcement

Create `core/min-org-role.decorator.ts`:

- `export const MIN_ORG_ROLE_KEY = 'minOrgRole';`
- `export const MinOrgRole = (role: OrgRole): ReturnType<typeof SetMetadata> =>
  SetMetadata(MIN_ORG_ROLE_KEY, role);`. It is a handler decorator. Document the role order and
  that the guard reads it right after the context resolves.

In `core/owner-context.guard.ts`:

- `#resolve`: call `lookup.findRole(user.sub, organizationId)`. If the result is `null`, throw
  `ownerNotFound()`. Otherwise return `{ kind: 'organization', organizationId, role }`. Personal
  stays `{ kind: 'user', userId }`.
- After assigning `request.ownerContext`, read
  `reflector.getAllAndOverride<OrgRole | undefined>(MIN_ORG_ROLE_KEY, [handler, class])`. If it
  is set and `!hasMinRole(ownerRole(ctx), min)`, throw `orgRoleForbidden()`. Because the check
  runs after `#resolve`, the 404 always comes first.
- Update the class doc and the constructor `@param`: membership plus role, the 403 after the
  uniform 404, and the role taken from the DB only.

`core/tests/owner-context.guard.spec.ts`:

- Make the `reflector.getAllAndOverride` mock key-aware: `IS_OWNER_SCOPED_KEY` → boolean,
  `MIN_ORG_ROLE_KEY` → role or undefined.
- Change `lookup` to `{ findRole: jest.fn() }`.
- Cases:
  - the organization context carries the role from the lookup;
  - personal context with any `@MinOrgRole` passes (it counts as `owner`);
  - a non-member (`null`) gets 404 and the role check never runs;
  - a malformed `:orgId` gets 404 without a lookup;
  - `user` on an `admin` route gets a `ForbiddenException` with the default body;
  - `admin` and `owner` pass an `admin` route;
  - with no `@MinOrgRole`, the route passes for any member (reads).

## Files to Change
- `backend/src/core/min-org-role.decorator.ts` — new decorator and key.
- `backend/src/core/owner-context.guard.ts` — `findRole`, role in context, role check, docs.
- `backend/src/core/tests/owner-context.guard.spec.ts` — key-aware reflector mock; role cases.
- `backend/src/auth/tests/owner-scoped.e2e-spec.ts` and `backend/src/core/tests/owner-scoped.module.e2e-spec.ts` — expected `ownerContext` bodies now include `role`.
