# Organizations

> **Defined by [#28](https://github.com/darthjee/ward/issues/28)**; skeleton by
> [#27](https://github.com/darthjee/ward/issues/27); **revised by
> [#40](https://github.com/darthjee/ward/issues/40)** (optional organizations, user-or-organization
> ownership). Part of Epic [#26](https://github.com/darthjee/ward/issues/26) (Bank module).

## Summary

- Two new entities in the `auth` module: **`Organization`** and **`OrganizationMembership`**.
- Membership **roles** (`owner` / `admin` / `user`) are **stored but not enforced**: every
  member can do every in-scope action.
- Every organization has **exactly one owner**.
- Organizations are **optional**: none is created at registration, and belonging to **zero
  organizations is the normal state**. Users create organizations later.
- The **active context** — **Personal** or an organization — lives in the URL (personal:
  `/api/<module>/...`, `/<module>/...`; organization: `/api/orgs/:orgId/...`, `/orgs/:orgId/...`).
- Bank data is **user-or-organization-owned** (exactly one owner per record); the other modules
  stay user-owned.
- Deferred concerns (permission system, joining, closing, creation rate limit) are listed in
  the banking [Future epics](../banking/README.md#future-epics).

## Permissions

- **No role-based permissions in this scope.** `OrganizationMembership.role` (`owner` /
  `admin` / `user`) is **stored** — the creator of an organization gets `owner` — but it is **not enforced**: every member of an organization can read,
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
- **Personal data is owner-only.** A user's personal records are visible to that user alone:
  never to organization members — not even members of an organization the user belongs to —
  and never to the global `is_admin`.

## Ownership

- An organization has **exactly one owner** at all times. Its creator (through
  `POST /orgs.json`) is the owner; future invited members join as `user`.
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

## Creating an organization

- Registration **touches only `users`**: no organization and no membership are created.
- Users create organizations later through `POST /orgs.json`, from the **"Create
  organization"** entry in the context switcher (see [Active context](#active-context)).

## Joining an organization

- How a user joins another organization (invites by username/email, invite links, accept step)
  is **deferred** — see [Future epics](../banking/README.md#future-epics).
- Until then, the only way to become a member is to **create** the organization (through
  `POST /orgs.json`), so every organization has exactly one member: its owner.

## Active context

- The active context lives **in the URL**. It is either:
  - **Personal** — the current user's own data: API `/api/<module>/...` (e.g.
    `/api/bank/accounts`), UI `/<module>/...`;
  - **an organization** — API `/api/orgs/:orgId/<module>/...` (e.g.
    `/api/orgs/:orgId/bank/accounts`), UI `/orgs/:orgId/<module>/...`.
- The UI has a **context switcher** listing **Personal**, each of the user's organizations and a
  **"Create organization"** entry. Selecting a context navigates to that context's URL.
- With **zero organizations** (the normal case) the switcher shows only Personal and "Create
  organization".
- The backend verifies on **every** organization route that the current user is a member of
  `:orgId`; otherwise it answers as if the resource did not exist (404). Personal routes carry
  no user id: the owner is always the current user from the JWT.
- Being in the URL, the context lets several browser tabs work on different contexts at once.
- When no context is in the URL (e.g. right after login), the UI picks:
  1. the **last used context**, remembered in the browser;
  2. otherwise **Personal**.

## Backfill

- **Not needed.** There is no production deployment with real data yet; local/dev databases
  are simply reset.

## Data ownership

This replaces the "every domain record belongs to exactly one user" rule in `product.md` with
two kinds of module. In this section, **owner** means a record's owner (the *owner context*),
not the membership role `owner`.

- **User-owned modules** — the existing modules and the planned `protocol`, `car-performance`
  and `links` **stay as they are**: each record belongs to one user through `userId`.
- **User-or-organization-owned modules** (`bank`):
  - every **owner-root** record has **exactly one owner — either a user or an organization**,
    never both. It is stored as **two nullable logical references** (to a user and to an
    organization), with a **DB check constraint that exactly one is set**; both are indexed,
    with no physical FK across module tables;
  - **child records inherit the owner through their root** and never store their own copy, so
    they cannot drift;
  - the user reference means **owner, never creator**: an organization record has its user
    reference `NULL` even though a member created it, so a personal query can never return
    organization records. There is **no `created_by` column** (authorship/audit is out of
    scope);
  - a user reads or changes a personal record only if they are its owner, and an organization
    record only if they are a **member** of that organization (all members have equal rights
    while roles are not enforced);
  - organization data belongs to the organization, not to whoever created it: it **outlives its
    creator's membership or account status**.
- Each module page states which kind it is; **each module declares exactly one kind**. #28's
  purely organization-scoped kind is **dropped**: no module uses it now that `bank` also has
  personal data.
- **"Personal" is a context label only** — it is not an organization and not a flag on
  `Organization` (#28 already rejected a "personal" flag).
- Ward's global `is_admin` still covers **accounts only** — no access to anyone's personal data
  nor to any organization's data.

### `data-access` checks for user-or-organization-owned modules

The `data-access` reviewer checks, for user-or-organization-owned modules, that:

- every query is filtered via the **`OwnerContext`** resolved by the owner-context guard;
- personal queries use **only the JWT user** as owner;
- every `/api/orgs/:orgId/...` route verifies the current user's membership of `:orgId`;
- **no owner fields** are read from input (URL beyond `:orgId`, or body) or written to output;
- unknown id, wrong context and non-member all get a **uniform 404** with identical bodies, with
  no disclosure that a record or organization exists.

User-owned modules keep the current checks.

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
  `auth`. This differs from the owner references of user-or-organization-owned modules, which
  cross modules and are therefore **logical** references (see `architecture/modular-pattern.md`).

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
- User-or-organization-owned modules (starting with `bank`) are mounted under **both**
  `/api/<module>/...` (personal) and `/api/orgs/:orgId/<module>/...` (organization), serving the
  same logic.

## Edge cases

- **Zero organizations** — the normal case: the user lands in the **Personal** context; the
  switcher shows only Personal and "Create organization".
- **Pending user** — nothing is created at registration; they cannot log in until approved, so
  they reach nothing. No special handling.
- **Denied user** — memberships and personal data are kept but unreachable (they cannot log
  in). No cleanup. Organization data they created belongs to the organization and outlives
  them.
- **Organization name** — trimmed; empty or whitespace-only → 400; longer than 255 characters
  → 400 (no truncation); any Unicode allowed, always rendered escaped. The limit matches
  `User.username` (`varchar(255)`).
- **Invalid `:orgId`** — unknown, non-numeric, or not a member → **404**, indistinguishable
  from one another. The organization id is never taken from the request body.
- **Personal routes never carry a user id** — personal always means the current user, so
  another user's personal data cannot be addressed; someone else's record id → **404**.
- **Wrong context** — an organization record's id on a personal route, or a personal record's
  id on an organization route → **404**, with the same body as an unknown id: records are
  looked up only inside the active owner context.
- **Owner fields in the body** — never accepted: the owner always comes from the route; unknown
  fields are rejected by the whitelist `ValidationPipe`.
- **Both owners or neither** — cannot exist: a DB check constraint enforces exactly one, and
  the API never builds such a record.
- **Child records** — reached only through their root in its context; a mismatch → 404.
- **Leaving an organization** (once joining/leaving exists) — the user loses access to its
  data; their personal data is unaffected.
- **Many organizations** — no cap on organizations per user; rate-limiting `POST /orgs.json`
  is deferred (see [Future epics](../banking/README.md#future-epics)).
- **Stale remembered context** — if the browser's last-used context returns 404 (e.g. an
  organization the user no longer belongs to), the UI forgets it and falls back to
  **Personal**.
- **Concurrent renames** — last write wins; no optimistic locking.
- **Deferred** — what happens to a user's personal data if user deletion is ever added is left
  to a future decision (Ward has no user deletion today).

## Security

- **Authentication** — every organization route requires the JWT guard (only `approved` users
  are authenticated, as today).
- **One owner-context guard** — one guard resolves the owner of every request to a
  user-or-organization-owned route, so the check cannot be forgotten per route:
  - **personal route** → the owner is the current user from the JWT, **never** from the URL or
    body;
  - **organization route** → it resolves `:orgId`, verifies the current user's membership and
    answers **404** otherwise.
  Services receive only the resulting **`OwnerContext`**, never a raw id, so every query is
  filtered by owner.
- **No client-supplied ids or roles** — `organizationId` comes only from the URL, after the
  membership check, never from the body. `role` is never accepted as input (create always sets
  `owner`). Rename accepts only `name`; unknown fields are rejected by the existing whitelist
  `ValidationPipe`.
- **Minimal responses** — organization routes return only `id`, `name`, the current user's
  `role` and timestamps. Records of user-or-organization-owned modules **never expose owner
  fields**: the context is implied by the route, and other users' ids are never leaked.
- **Caching** — `GET` routes are `user-scoped` (declared with `@CachePolicy`, sent with
  `X-Skip-Cache`, never shared by Tent); writes are `never`. An organization id in the URL does
  **not** make a response public. **Personal routes carry no owner in the URL**, so a shared
  cache would serve one user's data to another: they **must** be `user-scoped` and send
  `X-Skip-Cache`, with no exception. Organization routes stay `user-scoped` too. See
  `architecture/caching.md`.
- **XSS** — the organization name is user input and is always rendered escaped (React default;
  never injected as HTML).
- **Creation rate limit** — deferred (see [Future epics](../banking/README.md#future-epics)).

## Owning module

- **`auth`** (always-on) owns `Organization` and `OrganizationMembership` — identity data used
  by every user-or-organization-owned module. **No new module.**
- `auth` **exports `OrganizationService`** (e.g. `isMember(userId, orgId)` /
  `findMembership(userId, orgId)`). Other modules read memberships only through it, never by
  querying the tables.
- The **owner-context guard** lives in **`core`** behind a DI token implemented by `auth` — the
  same pattern as `SESSION_LOOKUP` (see `architecture/modular-pattern.md`) — and is exposed as
  a shared decorator, **`@OwnerScoped()`** (replacing #28's `@OrgScoped()`), that every
  user-or-organization-owned module (starting with `bank`) applies. It resolves the
  `OwnerContext` for both the personal and the organization prefix.
- `bank` stores its owner as **logical references** (no FK across module tables) — column names
  and route prefixes are in the banking README's
  [Bank ownership contract](../banking/README.md#bank-ownership-contract).
- `modules/auth.md` gains the new entities, routes and exported service when the specs are
  folded into the permanent docs.

## Out of scope / deferred

Recorded in the banking [Future epics](../banking/README.md#future-epics) section:

- **Organization permission system** — enforcing the role matrix.
- **Joining organizations** — invites, accept step, listing members, leaving, transferring
  ownership.
- **Closing (deleting) organizations** — and the fate of their data.
- **Organization-creation rate limit**.
- **Moving a record between owners** — e.g. an account from Personal to an organization.
- **Sharing a personal record with an organization** — without changing its owner.

Also out of scope: a backfill migration (no production data), and making any module other than
`bank` user-or-organization-owned.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/28
- Revising sub-issue (optional organizations, user-or-organization ownership): https://github.com/darthjee/ward/issues/40
- Follow-up realigning the banking specs: https://github.com/darthjee/ward/issues/41
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md
- Current data-ownership rule: https://github.com/darthjee/ward/blob/main/docs/agents/product.md
- Auth module (`User`, `@AdminOnly()`): https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth.md
- Core-token pattern (`SESSION_LOOKUP`) and logical cross-module references: https://github.com/darthjee/ward/blob/main/docs/agents/architecture/modular-pattern.md
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- Data-access reviewer: https://github.com/darthjee/ward/blob/main/.claude/agents/data-access.md

## Required tests

**Backend**

- Registration creates the user only — **no organization and no membership**.
- `POST /orgs.json` makes the requester `owner` and ignores or rejects `role` and
  `organizationId` in the body.
- The name is trimmed; empty, whitespace-only or longer than 255 characters → 400; exactly 255
  characters → OK.
- `GET` / `PATCH /orgs/:orgId.json` return 404 for an unknown id, a non-numeric id and a
  non-member, with identical bodies.
- A global admin who is not a member gets 404.
- Rename rejects unknown fields.
- Organization responses contain only `id`, `name`, `role` and timestamps.
- `GET` routes are `user-scoped` and send `X-Skip-Cache`; writes are `never`.
- The unique (`organization_id`, `user_id`) constraint holds.
- `@OwnerScoped()` resolves the JWT user as owner on personal routes and runs the membership
  check on organization routes (404 for a non-member).
- Unknown id, wrong context and non-member return identical 404s.
- Owner fields in the body are rejected.
- Responses of user-or-organization-owned routes contain no owner fields.
- The DB check rejects a record with both owners or neither.
- Personal routes are `user-scoped` and send `X-Skip-Cache`.
- A global admin gets no other user's personal data.

**Frontend**

- The switcher lists Personal, the user's organizations and "Create organization", and
  navigates to the right URL (`/<module>/...` or `/orgs/:orgId/<module>/...`).
- With no context in the URL, the UI uses the last-used context, then Personal.
- A stale remembered context (404) is forgotten and the UI falls back to Personal.
- With zero organizations, only Personal and "Create organization" are shown.
- The organization name is rendered escaped.
