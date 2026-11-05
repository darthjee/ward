# Organizations

> **Defined by [#28](https://github.com/darthjee/ward/issues/28)**; skeleton by
> [#27](https://github.com/darthjee/ward/issues/27). Part of Epic
> [#26](https://github.com/darthjee/ward/issues/26) (Bank module).

## Summary

- Two new entities in the `auth` module: **`Organization`** and **`OrganizationMembership`**.
- Membership **roles** (`owner` / `admin` / `user`) are **stored but not enforced**: every
  member can do every in-scope action.
- Every organization has **exactly one owner**.
- An organization is **auto-created at registration** for every new user.
- The **active organization lives in the URL** (`/api/orgs/:orgId/...`, `/orgs/:orgId/...`).
- Bank data is **organization-scoped**; the other modules stay user-scoped.
- Deferred concerns (permission system, joining, closing, creation rate limit) are listed in
  the banking [Future epics](../banking/README.md#future-epics).

## Permissions

- **No role-based permissions in this scope.** `OrganizationMembership.role` (`owner` /
  `admin` / `user`) is **stored** — the creator of an organization (including the auto-created
  one) gets `owner` — but it is **not enforced**: every member of an organization can read,
  create, edit and delete its bank data and perform every organization action defined here.
- The **permission system** (the per-role matrix — e.g. a `user` cannot delete bank data,
  member management, ownership transfer) is deferred to its own epic (see
  [Future epics](../banking/README.md#future-epics)). Because the role is already stored, that
  epic only adds rules — no data migration.
- Organization roles are **distinct from Ward's global admin role** (`User.isAdmin` /
  `@AdminOnly()`). The global `is_admin` grants **no** organization permissions: a Ward admin
  who is not a member sees nothing of an organization's data. Being an organization `owner` or
  `admin` grants nothing outside that organization.
- Every check is made against the user's membership in the **active organization**; there is
  no cross-organization access.

## Ownership

- An organization has **exactly one owner** at all times. Its creator (including the creator
  of the auto-created organization) is the owner; future invited members join as `user`.
- Ownership lives **only in the membership role** — there is no `ownerId` column on
  `Organization`.
- **Target behaviour** (implemented by the joining and closing epics, not in this scope):
  - any member **except the owner** may leave the organization;
  - the **owner cannot leave**: they must first **transfer ownership** to another member (the
    target becomes `owner`, the previous owner becomes `user` and may then leave) or **close**
    the organization;
  - transferring ownership and closing are **owner-only** — the only role checks foreseen
    before the full permission system.
- **In this scope there is no leave, transfer-ownership or close action.** The only
  organization-level actions are **create** and **rename**.

## Auto-created organization

- Every new user gets an organization created automatically, owned by them (`owner`).
- Its **name is the user's username** (e.g. `darthjee`), set once at creation.
- It **can be renamed**, like any organization.
- It is created **at registration, in the same transaction as the account**, including for
  `pending` users (a `denied` user's organization simply stays unused).
- It is a **normal organization** — no "personal" flag. Once joining exists, its owner can
  invite others into it.
- It **can be closed** like any organization (once closing exists). A user **may therefore
  belong to zero organizations**: they can still use Ward, but without access to any
  organization-scoped data. The UI shows an empty state inviting them to create (or, later,
  join) an organization. This state is not reachable through the UI yet, but the UI handles it.

## Joining an organization

- How a user joins another organization (invites by username/email, invite links, accept step)
  is **deferred** — see [Future epics](../banking/README.md#future-epics).
- Until then, the only way to become a member is to **create** the organization (at
  registration or through `POST /orgs.json`), so every organization has exactly one member:
  its owner.

## Active organization

- The active organization lives **in the URL**:
  - API routes are scoped as `/api/orgs/:orgId/...` (e.g. `/api/orgs/:orgId/bank/accounts`);
  - UI routes are scoped as `/orgs/:orgId/...`.
- The UI has an **organization switcher** for users who belong to several organizations. The
  switcher simply navigates to the other organization's URL.
- The backend verifies on **every** organization-scoped request that the current user is a
  member of `:orgId`; otherwise it answers as if the resource did not exist (404).
- Being in the URL, the organization id is naturally part of the Tent proxy's cache key, and
  several browser tabs can work on different organizations at once.
- When no organization is in the URL (e.g. right after login), the UI picks:
  1. the **last used organization**, remembered in the browser;
  2. otherwise the user's **first organization by creation date**;
  3. with **zero organizations**, the "create an organization" empty state.

## Backfill

- **Not needed.** There is no production deployment with real data yet, so no migration
  creates organizations for existing users. Only users registered after the feature ships get
  an auto-created organization; local/dev databases are simply reset.

## Data ownership

This replaces the "every domain record belongs to exactly one user" rule in `product.md` with
two kinds of module:

- **Organization-scoped modules** (`bank`): every record belongs to exactly **one
  organization**, stored as a **logical** `organizationId` reference to `auth` (no physical FK
  across module tables). A user reads or changes a record only if they are a **member** of that
  organization (all members have equal rights while roles are not enforced).
- **User-scoped modules**: the existing modules and the planned `protocol`, `car-performance`
  and `links` **stay as they are** — each record belongs to one user through `userId`.
- Each module page states which kind it is; **one module never mixes both**.
- Ward's global `is_admin` still covers **accounts only** — no access to any organization's
  data.
- Organization data belongs to the organization, not to whoever created it: it **outlives its
  creator's membership or account status**.

### `data-access` checks for organization-scoped modules

The `data-access` reviewer checks, for organization-scoped modules, that:

- every query is filtered by `organizationId`;
- every `/api/orgs/:orgId/...` route verifies the current user's membership of `:orgId`;
- an `organizationId` from the URL or body is never trusted without that membership check (and
  is never taken from the body at all);
- non-members get **404**, with no disclosure that the organization exists.

User-scoped modules keep the current checks.

`product.md` and `.claude/agents/data-access.md` are **not** edited by this spec: they are
updated when the specs are folded into the permanent docs (see [specs.md](../../specs.md)).

## Entities

Both entities live in the `auth` module.

### `Organization` (`organizations` table)

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | varchar(255) | required, trimmed, **not unique** |
| `created_at` / `updated_at` | timestamps | |

### `OrganizationMembership` (`organization_memberships` table)

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `organization_id` | FK → `organizations` | |
| `user_id` | FK → `users` | |
| `role` | varchar(16): `owner` / `admin` / `user` | stored, not enforced (see [Permissions](#permissions)) |
| `created_at` / `updated_at` | timestamps | |

- Unique (`organization_id`, `user_id`).
- Exactly **one `owner` membership per organization**.
- `organization_id` and `user_id` are **real FKs**: both tables, and `users`, are owned by
  `auth`. This differs from `bank`'s `organizationId`, which crosses modules and is therefore a
  **logical** reference (see `architecture/modular-pattern.md`).

## Routes

All routes are JWT-protected and live under `/api`:

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/orgs.json` | List the current user's organizations with their role in each (feeds the switcher) | `user-scoped` |
| POST | `/orgs.json` | Create an organization; **the requesting user becomes its owner** | `never` |
| GET | `/orgs/:orgId.json` | Organization details; 404 unless the user is a member | `user-scoped` |
| PATCH | `/orgs/:orgId.json` | Rename the organization (any member) | `never` |

- **Response shape** — each organization is returned as `id`, `name`, the current user's
  `role` in it, and `created_at` / `updated_at`. Never member lists or other users' ids.
- `POST` and `PATCH` accept only `name`.
- **Listing members is out of scope** — every organization has a single member until the
  joining epic.
- Organization-scoped routes of other modules (starting with `bank`) live under
  `/api/orgs/:orgId/<module>/...`.

## Edge cases

- **Denied user** — memberships are kept; the user cannot log in, so their organization simply
  sits unused. No cleanup.
- **Pending user** — the organization exists from registration but is unreachable until the
  user is approved. No special handling.
- **Registration atomicity** — user, organization and owner membership are created in **one
  transaction**; any failure rolls back all three (never a user without an organization, nor
  an organization without an owner).
- **Organization name** — trimmed; empty or whitespace-only → 400; longer than 255 characters
  → 400 (no truncation); any Unicode allowed, always rendered escaped. The limit matches
  `User.username` (`varchar(255)`), so the auto-created name always fits.
- **Invalid `:orgId`** — unknown, non-numeric, or not a member → **404**, indistinguishable
  from one another. The organization id is never taken from the request body.
- **Username change** — the auto-created organization's name is set once at creation and does
  **not** follow later username edits.
- **Many organizations** — no cap on organizations per user; rate-limiting `POST /orgs.json`
  is deferred (see [Future epics](../banking/README.md#future-epics)).
- **Stale remembered organization** — if the browser's last-used organization returns 404, the
  UI forgets it and falls back to the user's first organization.
- **Concurrent renames** — last write wins; no optimistic locking.

## Security

- **Authentication** — every organization route requires the JWT guard (only `approved` users
  are authenticated, as today).
- **Single membership check** — one guard resolves `:orgId`, verifies the current user's
  membership and answers **404** otherwise. Every organization-scoped route (including
  `bank`'s) goes through it, so the check cannot be forgotten per route.
- **No client-supplied ids or roles** — `organizationId` comes only from the URL, after the
  membership check, never from the body. `role` is never accepted as input (create always sets
  `owner`). Rename accepts only `name`; unknown fields are rejected by the existing whitelist
  `ValidationPipe`.
- **Minimal responses** — only `id`, `name`, the current user's `role` and timestamps.
- **Caching** — `GET` routes are `user-scoped` (declared with `@CachePolicy`, sent with
  `X-Skip-Cache`, never shared by Tent); writes are `never`. An organization id in the URL does
  **not** make a response public. See `architecture/caching.md`.
- **XSS** — the organization name is user input and is always rendered escaped (React default;
  never injected as HTML).
- **Creation rate limit** — deferred (see [Future epics](../banking/README.md#future-epics)).

## Owning module

- **`auth`** (always-on) owns `Organization` and `OrganizationMembership` — identity data used
  at registration and by every organization-scoped module. **No new module.**
- **Auto-creation** happens inside `auth`, in the registration transaction, through a direct
  call to its `OrganizationService` — **not** through the post-registration event: events are
  fire-and-forget, cannot share the registration transaction, and are unreliable with lazy
  listeners.
- `auth` **exports `OrganizationService`** (e.g. `isMember(userId, orgId)` /
  `findMembership(userId, orgId)`). Other modules read memberships only through it, never by
  querying the tables.
- The **membership guard** lives in **`core`** behind a DI token implemented by `auth` — the
  same pattern as `SESSION_LOOKUP` (see `architecture/modular-pattern.md`) — and is exposed as
  a shared decorator, `@OrgScoped()`, that every organization-scoped module (starting with
  `bank`) applies.
- `bank` stores `organizationId` as a **logical reference** (no FK across module tables).
- `modules/auth.md` gains the new entities, routes and exported service when the specs are
  folded into the permanent docs.

## Out of scope / deferred

Recorded in the banking [Future epics](../banking/README.md#future-epics) section:

- **Organization permission system** — enforcing the role matrix.
- **Joining organizations** — invites, accept step, listing members, leaving, transferring
  ownership.
- **Closing (deleting) organizations** — and the fate of their data.
- **Organization-creation rate limit**.

Also out of scope: a backfill migration (no production data), and moving any module other than
`bank` to organization scope.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/28
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md
- Current data-ownership rule: https://github.com/darthjee/ward/blob/main/docs/agents/product.md
- Auth module (`User`, `@AdminOnly()`): https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth.md
- Core-token pattern (`SESSION_LOOKUP`) and logical cross-module references: https://github.com/darthjee/ward/blob/main/docs/agents/architecture/modular-pattern.md
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- Data-access reviewer: https://github.com/darthjee/ward/blob/main/.claude/agents/data-access.md

## Required tests

**Backend**

- Registration creates the user, the organization (named after the username) and the `owner`
  membership; a forced failure rolls back all three.
- A `pending` user also gets an organization.
- `POST /orgs.json` makes the requester `owner` and ignores or rejects `role` and
  `organizationId` in the body.
- The name is trimmed; empty, whitespace-only or longer than 255 characters → 400; exactly 255
  characters → OK.
- `GET` / `PATCH /orgs/:orgId.json` return 404 for an unknown id, a non-numeric id and a
  non-member, with identical bodies.
- A global admin who is not a member gets 404.
- Rename rejects unknown fields.
- Responses contain only `id`, `name`, `role` and timestamps.
- `GET` routes are `user-scoped` and send `X-Skip-Cache`; writes are `never`.
- The unique (`organization_id`, `user_id`) constraint holds.
- A username change does not rename the organization.
- `@OrgScoped()` returns 404 for a non-member on any route it decorates.

**Frontend**

- The switcher lists the user's organizations and navigates to `/orgs/:orgId/...`.
- With no organization in the URL, the UI uses the last-used organization, then the first by
  creation date.
- A stale remembered organization (404) is forgotten and the UI falls back.
- With zero organizations, the UI shows the empty state.
- The organization name is rendered escaped.
