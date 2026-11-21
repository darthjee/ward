# Rename requires admin

`PATCH orgs/:orgId.json` is not owner-scoped and stays that way. It gets no `@MinOrgRole`.

In `auth/organization.service.ts` `rename(userId, orgId, name)`:

- After `findMembership` and the existing `ownerNotFound()` when it returns null, add
  `if (!hasMinRole(found.membership.role, OrgRole.ADMIN)) throw orgRoleForbidden();`, then
  save.
- Update the JSDoc: drop "any role; last write wins", and say it requires `admin` or `owner`,
  with last write winning among them. Add `@throws {ForbiddenException}`.

In `auth/organization.controller.ts`, update the class doc and the `rename` JSDoc: order 400
body → 404 membership → 403 role. The `@StrictBody()` placement stays unchanged.

Tests:

- `auth/tests/organization.service.spec.ts`: `user` → `ForbiddenException`, and nothing is
  saved; `admin` and `owner` → renamed; non-member → 404.
- e2e: add `auth/tests/organization.controller.rename.e2e-spec.ts` (or extend the existing
  organization e2e files).
  - Seed memberships through `membershipRepo.rows`.
  - Assert that `user` gets `UNIFORM_403` and the name is unchanged, and that `admin` and
    `owner` get 200.
  - Assert that a non-member or malformed `:orgId` gets `UNIFORM_404`.
  - Assert that an invalid body from a `user` gets 400, which confirms the order.
- `POST orgs.json` stays open to any authenticated user, and the creator becomes `owner`.
  Existing specs already cover this.

## Files to Change
- `backend/src/auth/organization.service.ts` — role check in `rename`; JSDoc.
- `backend/src/auth/organization.controller.ts` — class and `rename` docs.
- `backend/src/auth/tests/organization.service.spec.ts` — rename role cases.
- `backend/src/auth/tests/organization.controller.rename.e2e-spec.ts` — new e2e (or extend the existing organization e2e).
