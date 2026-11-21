# OrgRole, hasMinRole and the 403 factory in core

`core` must not import `auth`, so the role definition moves to `core`, and `auth` reuses it.

Create `core/org-role.ts`:

- `export const OrgRole = { USER: 'user', ADMIN: 'admin', OWNER: 'owner' } as const;` and
  `export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];`. This is the same const-object
  and type pattern as `MembershipRole`.
- A private rank table `user: 0`, `admin: 1`, `owner: 2`.
- `hasMinRole(role: OrgRole, min: OrgRole): boolean`.
- `orgRoleForbidden(): ForbiddenException`, which returns `new ForbiddenException()`. This is the
  single 403 factory for the guard, the transaction rule and rename. Document that it names
  neither the resource nor the required role, and that the global filter renders it as
  `{ error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode: 403, timestamp }`.

In `auth/entities/organization-membership.entity.ts`:

- Make `MembershipRole` an alias of `OrgRole`: `export const MembershipRole = OrgRole;` and
  `export type MembershipRole = OrgRole;`. Existing `MembershipRole.OWNER` uses keep compiling.
- Update its doc comment: roles are enforced (see `@MinOrgRole` and `hasMinRole`), with the order
  `user` < `admin` < `owner`. Drop "Stored but not enforced" and the `ADMIN` "Reserved for the
  future permission system" note.

Unit spec `core/tests/org-role.spec.ts`:

- full `hasMinRole` truth table (3×3);
- `orgRoleForbidden()` is a `ForbiddenException` whose response is the Nest default body.

## Files to Change
- `backend/src/core/org-role.ts` — new: `OrgRole`, `hasMinRole`, `orgRoleForbidden`.
- `backend/src/core/tests/org-role.spec.ts` — new unit spec.
- `backend/src/auth/entities/organization-membership.entity.ts` — `MembershipRole` reuses `OrgRole`; doc comment.
