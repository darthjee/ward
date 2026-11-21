# Lookup port: findRole replaces isMember

In `core/organization-membership-lookup.ts`:

- Replace `isMember` with `findRole(userId: number, orgId: number): Promise<OrgRole | null>`.
- Document the port: `null` means the user is not a member, and the caller answers the uniform
  404. The method makes one indexed lookup on `(organization_id, user_id)`, with no existence
  pre-check, no caching and no admin bypass.

In `auth/organization.service.ts`:

- Implement `findRole` as `membershipRepository.findOne({ where: { organizationId: orgId,
  userId }, select: { role: true } })` and return `row?.role ?? null`. This is still one query on
  the unique index.
- Remove `isMember`.
- Update the class doc's port mention and `auth/auth.module.ts`'s "checks memberships" comment
  (it now resolves the member's role).

Update the fakes and specs:

- `auth/tests/organization.service.spec.ts`: change `describe('isMember')` to
  `describe('findRole')`. Cover the role of a member, `null` for a non-member, and `null` for an
  unknown organization.
- `auth/tests/support/in-memory-organization-repos.ts`: make sure `findOne` with `where` (and an
  optional `select`) is supported, and fix the comment that mentions `isMember`.
- `bank/tests/support/build-bank-test-app.ts`:
  - Change `FakeMembershipLookup` to a `Map<string, OrgRole>`. Keep `'7:3'` and `'8:4'` as
    `owner`, so the existing specs are unchanged.
  - Export a way to seed extra memberships per test, for example
    `seedMembership(userId, orgId, role)` on the harness return value. Step 06 needs it.
- `core/tests/owner-scoped.module.e2e-spec.ts`: change the inline fake to `findRole`.

This step and step 04 must land together in one commit (or step 04 immediately after), because
the guard calls the port.

## Files to Change
- `backend/src/core/organization-membership-lookup.ts` — `findRole` signature and docs.
- `backend/src/auth/organization.service.ts` — implement `findRole`; remove `isMember`; class doc.
- `backend/src/auth/auth.module.ts` — comment.
- `backend/src/auth/tests/organization.service.spec.ts` — `findRole` specs.
- `backend/src/auth/tests/support/in-memory-organization-repos.ts` — `findOne` support and comment.
- `backend/src/bank/tests/support/build-bank-test-app.ts` — role-aware fake lookup and seeding helper.
- `backend/src/core/tests/owner-scoped.module.e2e-spec.ts` — fake uses `findRole`.
