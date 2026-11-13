# Auth — Organizations

Organizations let domain data belong to a group of users instead of one user. They are a
general concept that any module may reuse, so they live in the `auth` module next to `User`,
not in `bank`. Part of the [Auth module](../auth.md). Decided by Epic
[#26](https://github.com/darthjee/ward/issues/26) (sub-issues
[#28](https://github.com/darthjee/ward/issues/28) and
[#40](https://github.com/darthjee/ward/issues/40)), built by
[#46](https://github.com/darthjee/ward/issues/46) (backend) and
[#47](https://github.com/darthjee/ward/issues/47) (frontend).

Related pages, not duplicated here:

- [Auth routes](../../backend/routes/auth.md#organization-routes) — per-endpoint behavior.
- [Frontend](../../architecture/frontend.md#owner-context-organizations) — context switcher,
  remembered context, router.
- [Bank module](../bank.md) — the first user-or-organization-owned module and its
  [ownership contract](../bank.md#bank-ownership-contract).

## Summary

- Two entities: **`Organization`** and **`OrganizationMembership`**.
- Membership **roles** (`owner` / `admin` / `user`) are **stored but not enforced**: every
  member can do every in-scope action.
- Every organization has **exactly one owner**: its creator.
- Organizations are **optional**: registration creates none, and belonging to **zero
  organizations is the normal state**.
- The **active context** (Personal or an organization) lives in the URL.
- Domain data is either **user-owned** or **user-or-organization-owned**, one kind per module.
  `bank` is the only user-or-organization-owned module today.

## Entities

Both tables belong to `auth` (`backend/src/auth/entities/organization*.entity.ts`, migration
`20261107120015-auth-create-organizations.ts`).

### `Organization` (`auth_organizations`)

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | varchar(255) | Required, trimmed, **not unique**, never logged |
| `created_at` / `updated_at` | timestamps | |

There is no owner column: ownership lives only in the membership role.

### `OrganizationMembership` (`auth_organization_memberships`)

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `organization_id` | int, FK → `auth_organizations` | `ON DELETE RESTRICT` |
| `user_id` | int, FK → `auth_users` | `ON DELETE RESTRICT`; indexed |
| `role` | varchar(16): `owner` / `admin` / `user` | Stored, not enforced (see [Roles](#roles)) |
| `created_at` / `updated_at` | timestamps | |

- Unique index `(organization_id, user_id)`; it also serves the membership lookup.
- The FKs are **real**: both tables and `auth_users` belong to `auth`. The owner references of
  user-or-organization-owned modules cross modules, so they are **logical** instead (see
  [Data ownership](#data-ownership)).

## Roles

- `OrganizationMembership.role` is **stored**: the creator gets `owner`. It is **not
  enforced**: every member can read, create, edit and delete the organization's data and rename
  the organization.
- The permission system (the per-role matrix, member management, the role checks) is deferred to
  the *Organization permission system* epic
  ([#81](https://github.com/darthjee/ward/issues/81)). Because the role is already stored, that
  epic adds only rules, with no data migration.
- Organization roles are **distinct from Ward's global admin role** (`User.isAdmin` /
  `@AdminOnly()`). The global `is_admin` grants **no** organization access: a Ward admin who is
  not a member gets the same 404 as anyone else. Being an organization `owner` grants nothing
  outside that organization.
- Every check is made against the user's membership in the **active organization**; there is no
  cross-organization access.
- **Personal data is owner-only**: never visible to organization members (even of an
  organization the owner belongs to) nor to the global `is_admin`.

## Membership and ownership

- An organization has **exactly one owner** at all times. This is not a DB constraint: it holds
  because `OrganizationService#create` is the only code that writes memberships, and it always
  writes one `owner` row in the same DB transaction as the organization.
- The only organization-level actions are **create** and **rename** (any member). There is no
  leave, transfer-ownership or close action.
- Registration touches only `auth_users`: no organization and no membership are created. (The
  first organization spec, #28, auto-created one at registration; #40 reversed that before it
  was built.) Users create organizations from the **Create organization** entry of the context
  switcher, through `POST /orgs.json`.
- With no way to join, every organization has exactly one member: its owner.
- **Target behaviour**, for the deferred epics:
  - any member except the owner may leave;
  - the owner cannot leave without first transferring ownership (the target becomes `owner`,
    the previous owner becomes `user`) or closing the organization;
  - transfer and close are owner-only.

  Joining, listing members, leaving and transferring are the *Joining organizations* epic
  ([#82](https://github.com/darthjee/ward/issues/82)); closing, and what happens to the
  organization's data, is the *Closing (deleting) organizations* epic
  ([#83](https://github.com/darthjee/ward/issues/83)).

## Active context

- The active context lives **in the URL**:
  - **Personal** — the current user's own data: backend `/<module>/...` (for example
    `/bank/accounts.json`), UI `#/<module>/...`;
  - **an organization** — backend `/orgs/:orgId/<module>/...`, UI `#/orgs/:orgId/<module>/...`.

  The proxy adds the external `/api` prefix to backend paths.
- Being in the URL, the context lets several tabs work on different contexts at once.
- The UI's context switcher lists Personal, each of the user's organizations and **Create
  organization**. With zero organizations it shows only Personal and Create organization.
- When no context is in the URL (for example right after login), the UI uses the last used
  context remembered in the browser, otherwise Personal. The frontend mechanics are in
  [Frontend → Owner context](../../architecture/frontend.md#owner-context-organizations).

## Data ownership

Two kinds of module. Here **owner** means a record's owner context, not the membership role.

- **User-owned modules** — each record belongs to one user through a logical `userId`. This is
  the default for the planned `protocol`, `car-performance` and `links`.
- **User-or-organization-owned modules** (`bank`):
  - every **owner-root** record has **exactly one owner, either a user or an organization**,
    stored as two nullable, indexed, **logical** references (`user_id`, `organization_id`) with
    a DB check constraint that exactly one is set;
  - **child records inherit the owner through their root** and never store a copy;
  - the user reference means **owner, never creator**: an organization record has `user_id`
    `NULL` even though a member created it, so a personal query can never return it. There is
    no `created_by` column (see the *Authorship / audit trail* epic,
    [#95](https://github.com/darthjee/ward/issues/95));
  - a user reads or changes a personal record only if they own it, and an organization record
    only if they are a member;
  - organization data belongs to the organization and outlives its creator's membership or
    account status.
- Each module page states which kind it is. **"Personal" is a context label only**: it is not an
  organization and not a flag on `Organization`.
- Ward's global `is_admin` still covers **accounts only**: no access to anyone's personal data
  nor to any organization's data.
- Moving a record between owners and sharing a personal record with an organization are
  deferred (epics [#93](https://github.com/darthjee/ward/issues/93) and
  [#94](https://github.com/darthjee/ward/issues/94)).

## Owner-context mechanism

The owner of every request to a user-or-organization-owned route is resolved in one place, so
the check cannot be forgotten per route.

- **`OwnerContextGuard`** (`backend/src/core/owner-context.guard.ts`) is a global `APP_GUARD`,
  registered after `JwtGuard`. It does nothing on routes without the `@OwnerScoped()` metadata.
  On owner-scoped routes:
  - **personal prefix** (no `:orgId`) → the owner is the JWT user, never the URL or body;
  - **organization prefix** → `:orgId` is parsed strictly by `parseOrgId()` (a raw string, so
    `1e3` never becomes `1000`) and the membership is checked on **every** request, with no
    caching and no admin bypass. Every failure (missing user, malformed or unknown id,
    non-member) throws the same uniform 404.

  The result is stored as `request.ownerContext`.
- **`ORGANIZATION_MEMBERSHIP_LOOKUP`** (`core/organization-membership-lookup.ts`) is the port
  the guard depends on, so `core/` never imports `auth/` (the same pattern as `SESSION_LOOKUP`).
  `AuthModule` provides it with `OrganizationService`, which also exports `isMember(userId,
  orgId)` and `findMembership(userId, orgId)`. Other modules read memberships only through
  these, never by querying the tables.
- **`@OwnerScopedController(path)`** (`core/owner-scoped.decorator.ts`) mounts a controller
  under both `<path>` and `orgs/:orgId/<path>`, adds `@OwnerScoped()` and sets the cache class
  to `user-scoped`, so mounting, scoping and cache class cannot be separated. A route may narrow
  the class to `never` but never to `public`.
- **`@CurrentOwner()`** (`core/current-owner.decorator.ts`) gives handlers the resolved
  `OwnerContext` (`{ kind: 'user', userId }` or `{ kind: 'organization', organizationId }`).
  Services receive only this context, never a raw id.
- **`ownerWhere(ctx)`** / **`ownerSqlWhere(ctx, alias)`** (`core/owner-context.ts`) build the
  owner filter for TypeORM `where` objects and for raw SQL, so every query is filtered by
  owner.
- Handlers take bodies **only** through **`@StrictBody()`** (`core/strict-validation.pipe.ts`),
  so unknown fields, owner fields included, answer 400. A coverage spec fails on a plain
  `@Body()` and on a `public` owner-scoped route.

## Security rules

- **Authentication** — every organization route requires the JWT guard (only `approved` users
  are authenticated).
- **Uniform 404** — an unknown, non-numeric or foreign `:orgId`, and a non-member (a global
  admin included), all answer the same 404 body. Records of user-or-organization-owned modules
  are looked up only inside the active owner context, so the **wrong context** (an organization
  record on a personal route, or the reverse) answers the same 404 as an unknown id.
- **Personal routes carry no user id**: personal always means the JWT user, so another user's
  personal data cannot be addressed.
- **No client-supplied owner or role** — `organizationId` comes only from the URL, after the
  membership check. `role` is never input (create always sets `owner`). Organization bodies
  accept only `name`.
- **Organization name** — trimmed; required; at most **255 code points** (not UTF-16 units);
  no control characters (Unicode `Cc`); any other Unicode allowed. Always rendered escaped
  (React text, never HTML).
- **Minimal responses** — organization routes return only `id`, `name`, the caller's `role` and
  timestamps; never member lists or other users' ids. Records of user-or-organization-owned
  modules never expose owner fields.
- **Caching** — `GET` routes are `user-scoped` (`@CachePolicy`, `X-Cache-Allow`, cached per caller); writes are
  `never`. An organization id in the URL does **not** make a response public. Personal routes
  carry no owner in the URL, so a shared cache would leak one user's data to another: they
  **must** be `user-scoped`, with no exception. See
  [Caching](../../architecture/caching.md).
- **Concurrent renames** — last write wins; no optimistic locking.

### `data-access` checks for user-or-organization-owned modules

The `data-access` reviewer checks, for user-or-organization-owned modules, that:

- every query is filtered through the **`OwnerContext`** resolved by `OwnerContextGuard`
  (`ownerWhere()` / `ownerSqlWhere()`);
- personal queries use **only the JWT user** as owner;
- every `/orgs/:orgId/...` route verifies the current user's membership of `:orgId` (it is
  mounted with `@OwnerScopedController()` or carries `@OwnerScoped()`);
- **no owner fields** are read from input (the URL beyond `:orgId`, or the body) or written to
  output;
- unknown id, wrong context and non-member all get a **uniform 404** with identical bodies,
  with no disclosure that a record or organization exists.

User-owned modules keep the usual per-user checks.

## Edge cases

- **Zero organizations** — the normal case: the user works in Personal.
- **Pending or denied user** — cannot log in, so reaches nothing. A denied user's memberships
  and personal data are kept but unreachable; organization data they created belongs to the
  organization.
- **Many organizations** — no cap per user. Rate-limiting `POST /orgs.json` is the
  *Organization-creation rate limit* epic ([#84](https://github.com/darthjee/ward/issues/84)).
- **Stale remembered context** — an organization the user no longer belongs to is dropped by
  the frontend (see [Frontend](../../architecture/frontend.md#owner-context-organizations)) and
  the UI falls back to Personal.
- **User deletion** — Ward has none; what would happen to personal data is left to a future
  decision.

## Deferred

- Organization permission system: [#81](https://github.com/darthjee/ward/issues/81)
- Joining organizations (invites, members, leave, transfer):
  [#82](https://github.com/darthjee/ward/issues/82)
- Closing (deleting) organizations: [#83](https://github.com/darthjee/ward/issues/83)
- Organization-creation rate limit: [#84](https://github.com/darthjee/ward/issues/84)
- Move a record between owners: [#93](https://github.com/darthjee/ward/issues/93)
- Share a personal record with an organization:
  [#94](https://github.com/darthjee/ward/issues/94)

## Differences from the original spec

- **Table names** are `auth_organizations` / `auth_organization_memberships` (the spec said
  `organizations` / `organization_memberships`), following the module's `auth_` prefix. Their
  FKs are `ON DELETE RESTRICT`.
- **Exactly one owner** is enforced by code (`OrganizationService#create` is the only writer),
  not by a DB constraint.
- **Name validation** also rejects control characters and counts the length in code points.
- **`PATCH /orgs/:orgId.json`** validates the body first, so an invalid body answers 400 even
  for an unknown or foreign organization. This reveals nothing, since the 400 depends only on
  the body; owner-scoped routes answer their 404 first.
- **The owner-context mechanism** has concrete names: `OwnerContextGuard` (global `APP_GUARD`),
  the `ORGANIZATION_MEMBERSHIP_LOOKUP` port, `@OwnerScopedController()`, `@OwnerScoped()`,
  `@CurrentOwner()` and the `ownerWhere()` / `ownerSqlWhere()` helpers. The spec only said "a
  core guard behind a DI token".
- **Unknown body fields** are rejected by `@StrictBody()`, not by the whitelist
  `ValidationPipe`.
- **No `/api` prefix in the backend**: routes are `/orgs.json`, `/bank/...` and so on; the
  proxy adds `/api`. The spec wrote `/api/...`.
- **The organization list** is ordered by id.
