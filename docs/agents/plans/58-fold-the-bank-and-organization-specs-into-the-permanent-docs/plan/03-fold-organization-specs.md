# Fold the organization specs into the auth module docs

Organizations live in the `auth` module (`backend/src/auth/organization.controller.ts`,
`organization.service.ts`, `organization-response.ts`, `entities/organization*.entity.ts`), but
no permanent doc describes them yet. Write that documentation from
`specs/auth/README.md` and `specs/auth/organizations.md`, checked against the code.

## `modules/auth/organizations.md` (new)

Open it with `# Auth — Organizations` and a link back to [Auth module](../auth.md). It covers:

- **Entities**: `Organization` (`auth_organizations`) and `OrganizationMembership`
  (`auth_organization_memberships`), with their columns, the unique `(organization_id, user_id)`
  index, and FKs to `auth_users` with `ON DELETE RESTRICT`.
- **Roles**: `owner`, `admin` and `user` are stored, but not enforced yet. Exactly one owner
  per organization, guaranteed by `OrganizationService#create` being the only writer, not by a
  DB constraint. Ward's global `is_admin` grants no organization access (it gets a 404).
- **Organizations are optional**: registration creates none, so having zero organizations is
  the normal state. Creating one makes the creator its owner. Check what the code does about an
  "auto-created organization" and write down the actual behaviour, including the #40 reversal.
- **The active organization in the URL**: UI paths `/orgs/:orgId/...` vs personal paths. Point
  at `architecture/frontend.md#owner-context-organizations` for the frontend mechanics
  (remembered context, switcher).
- **The data-ownership rule**: every domain record belongs to exactly one user **or**
  organization. Children inherit the owner through their parent, and owner fields never appear
  in responses.
- **The owner-context mechanism**:
  - `OwnerContextGuard` (global `APP_GUARD`);
  - the `ORGANIZATION_MEMBERSHIP_LOOKUP` port, implemented by `OrganizationService`
    (`isMember`, `findMembership` exported);
  - `@OwnerScopedController(path)` (mounts both prefixes and adds `@OwnerScoped()` and
    `user-scoped`), `@OwnerScoped()` and `@CurrentOwner()`;
  - the `ownerWhere()` / `ownerSqlWhere()` helpers.
- **Security rules**:
  - a non-member, unknown or foreign `:orgId` answers 404;
  - personal routes use only the JWT user;
  - unknown body fields are rejected by `@StrictBody()`;
  - name validation: length in code points, no control characters;
  - the cache classes.
- The **`data-access` checks for user-or-organization-owned modules**, carried over from the
  spec's section of that name. This is the anchor that step 04 points the `data-access` agent
  files at.
- **Deferred**: links to epics 1–4 (permissions, joining / leaving / transfer, closing,
  creation rate limit).
- **Differences from the original spec**:
  - the table names;
  - the owner rule is enforced by code, not by the DB;
  - 400 before 404 on rename;
  - the guard and decorator names;
  - `@StrictBody()`;
  - no `/api` prefix in the backend;
  - the org list is ordered by id.

## `modules/auth.md`

- In `## Routes`, add an **Organization routes** subsection
  (`OrganizationController`): `GET /orgs.json`, `POST /orgs.json`, `GET /orgs/:orgId.json`,
  `PATCH /orgs/:orgId.json`, each with auth and cache class. Link `auth/organizations.md`.
- In `## Entities`, add short rows for the two organization tables that link
  `auth/organizations.md`.
- Link `auth/organizations.md` from the page intro, next to the user-approval link.

## `backend/routes/auth.md`

Add a per-endpoint section for the four organization routes, in the same table format as the
existing endpoints. Mention the controller in the opening paragraph. This fills the
"routes are complete" gap: no organization routes doc exists today.

## Files to Change
- `docs/agents/modules/auth/organizations.md` — new
- `docs/agents/modules/auth.md` — organization routes, entity rows and links
- `docs/agents/backend/routes/auth.md` — organization endpoint sections
