# Issue: Enhance the banking specs: organizations and memberships

## Description

Part of Epic #26 (Bank module). Ward's first domain module, `bank` (lazy tier), tracks bank accounts, business expenses for the accountant and bills to pay, scoped to **organizations**. The feature follows the spec lifecycle in `docs/agents/specs.md`: specs are written under `docs/agents/specs/banking/` first, refined by enhancement sub-issues, then implemented, folded into the permanent docs and removed.

This sub-issue **refines the specs**: it turns the stub written by the initial-specs sub-issue
into an agreed definition. It is documentation-only — no code.

Write the **organizations and memberships** definition into the banking specs (organizations
live in the `auth` module), following the decisions below: permissions (roles stored, not
enforced), ownership, the auto-created organization, the active organization, data ownership,
entities and routes, edge cases, security, owning module, and a **Future epics** section for
everything deferred (permission system, joining, closing organizations, creation rate limit).

Update the `docs/agents/specs/banking/README.md` index entry for the file(s) touched. Each
file keeps the **Reference** and **Required tests** sections required by
`docs/agents/specs.md`.

**Depends on:** The initial-specs sub-issue (`docs/agents/specs/banking/` must exist). Can run in parallel with
the other spec-enhancement sub-issues.

## Problem

The banking specs need organizations before any bank data can be specified: `product.md` still
says every domain record belongs to exactly one user, and the `organizations` stub left by #27
does not yet define the entities, routes, ownership rules, active-organization selection or
the security and data-access checks. Many related concerns (permissions, joining, closing,
rate limiting) are also open and must be explicitly deferred so they are not lost.

## Expected Behavior

- `docs/agents/specs/auth/organizations.md` (the stub created by #27) holds the agreed
  definition below: permissions, ownership, auto-created organization, active organization,
  data ownership, entities and routes, edge cases, security and owning module.
- The banking specs gain a **Future epics** section listing every deferred concern.
- `docs/agents/specs.md` describes the lifecycle change: before a spec is removed, an epic is
  created on GitHub for each entry in its Future epics section.
- `docs/agents/specs/banking/README.md` index entries are updated for every file touched.
- Every touched file keeps its **Reference** and **Required tests** sections.
- No code, and no edits to `product.md`, `.claude/agents/data-access.md` or `modules/auth.md`
  (those change when the specs are folded into the permanent docs).

## Solution

### Permissions (decided)

- **No role-based permissions in this scope.** `OrganizationMembership.role` (`owner` / `admin` /
  `user`) is **stored** — the creator of an organization (including the auto-created one) gets
  `owner` — but it is **not enforced**: every member of an organization can read, create, edit
  and delete its bank data and perform every organization action defined in these specs.
- The **permission system** (the per-role matrix — e.g. a `user` cannot delete bank data,
  member management, ownership transfer) is deferred to **its own future epic**. Storing the
  role now means that epic only adds rules, without a data migration.
- Ward's global `is_admin` grants **no** organization permissions: a Ward admin who is not a
  member sees nothing of an organization's data.
- Every check is made against the user's membership in the **active organization**; there is
  no cross-organization access.

### Ownership (decided)

- An organization has **exactly one owner** at all times. Its creator (including the creator of
  the auto-created organization) is the owner; invited members join as `user`.
- **Any member except the owner may leave** the organization.
- **The owner cannot leave.** To get out, the owner must either:
  - **transfer ownership** to another member — the target becomes `owner` and the previous
    owner becomes `user` (and may then leave); or
  - **close (delete) the organization**.
- Transferring ownership and closing the organization are **owner-only** — the only role checks
  in this scope (everything else is open to every member, see Permissions).

### Auto-created organization (decided)

- Every new user gets an organization created automatically, owned by them (`owner`).
- Its **name is the user's username** (e.g. `darthjee`).
- It **can be renamed**, like any organization.
- It is created **at registration, in the same transaction as the account**, including for
  `pending` users (a `denied` user's organization simply stays unused).
- It is a **normal organization** — no "personal" flag; its owner can invite others into it.
- It **can be closed** like any organization. A user **may belong to zero organizations**: they
  can still use Ward, but without access to any organization-scoped data (e.g. bank data) —
  the UI shows an empty state inviting them to create or join an organization.

### Joining an organization (deferred)

- How a user joins another organization (invites by username/email, invite links, accept step)
  is **out of scope** — it belongs to a **future epic**.
- Until then, the only way to become a member of an organization is to **create it** (at
  registration or by creating one), so every organization has exactly one member: its owner.

### Future epics (decided)

Deferred work is **recorded in the specs, not opened as GitHub issues now**:

- The banking specs get a **"Future epics"** section listing every deferred concern with
  enough detail to seed an epic later. From this issue:
  - **Organization permission system** — the per-role matrix (`owner` / `admin` / `user`),
    e.g. a `user` cannot delete bank data.
  - **Joining organizations** — invites (username/email, link), accept step, and the actions
    that only make sense with several members: **leaving** an organization and **transferring
    ownership**.
- **Spec lifecycle change** (`docs/agents/specs.md`): before a completed spec is folded into the
  permanent docs and removed, an epic is **created on GitHub for each entry in its "Future
  epics" section**, so nothing deferred is lost when the spec is deleted.
  - **Closing (deleting) organizations** — owner-only; must decide what happens to the
    organization's data (hard delete with typed-name confirmation, soft delete/archive, or
    refuse while data exists).
  - **Organization-creation rate limit** — cap organizations created per user per time window
    (configurable via env vars, 429 when exceeded); unlike the existing failure-based lockouts,
    this is a volume limit.
- Consequently, in this scope there is **no** leave, transfer-ownership or close action: the
  rules in Ownership describe the target behaviour, implemented by the joining and closing
  epics. The only organization-level actions in scope are **creating** and **renaming**.
- The zero-organizations state (see Auto-created organization) is therefore not reachable yet
  through the UI, but the UI still handles it.

### Active organization (decided)

- The UI has an **organization switcher** for users who belong to several organizations.
- The active organization lives **in the URL**: API routes are scoped as
  `/api/orgs/:orgId/...` (e.g. `/api/orgs/:orgId/bank/accounts`) and UI routes as
  `/orgs/:orgId/...`. The switcher simply navigates to the other organization's URL.
- The backend verifies on **every** organization-scoped request that the current user is a
  member of `:orgId`; otherwise it answers as if the resource did not exist.
- Being in the URL, the organization id is naturally part of the cache key (Tent proxy) and
  lets several tabs work on different organizations at once.
- When no organization is in the URL (e.g. right after login), the UI picks the **last used
  organization** (remembered in the browser), falling back to the user's first organization by
  creation date; a user with **zero organizations** sees the "create an organization" empty
  state.

### Backfill (not needed)

- There is **no production deployment with real data** yet, so **no backfill migration** is
  needed to create organizations for existing users. Only users registered after the feature
  ships get an auto-created organization; local/dev databases can simply be reset.

### Data ownership (decided)

Replaces the "every domain record belongs to exactly one user" rule in `product.md` with two
kinds of module:

- **Organization-scoped modules** (`bank`): every record belongs to exactly **one
  organization**, stored as a logical `organizationId` reference to Auth. A user reads or
  changes a record only if they are a **member** of that organization (all members have equal
  rights while roles are not enforced).
- **User-scoped modules**: the existing modules (and the planned `protocol`,
  `car-performance`, `links`) **stay as they are** — each record belongs to one user through
  `userId`.
- Each module page states which kind it is; one module never mixes both.
- Ward's global `is_admin` still covers **accounts only** — no access to any organization's
  data.
- Organization data belongs to the organization, not to whoever created it: it outlives its
  creator's membership or account status.

**Impact on the `data-access` agent** (`.claude/agents/data-access.md`) — for
organization-scoped modules it checks that:

- every query is filtered by `organizationId`;
- every `/api/orgs/:orgId/...` route verifies the current user's membership of `:orgId`;
- an `organizationId` from the URL or body is never trusted without that membership check;
- non-members get **404** (no disclosure that the organization exists).

User-scoped modules keep the current checks.

### Entities and routes (decided)

Both entities live in the `auth` module.

**`Organization`** (`organizations` table)

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | varchar(255) | required, trimmed, **not unique** |
| `created_at` / `updated_at` | timestamps | |

**`OrganizationMembership`** (`organization_memberships` table)

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `organization_id` | FK → `organizations` | |
| `user_id` | FK → `users` | |
| `role` | varchar(16): `owner` / `admin` / `user` | stored, not enforced (see Permissions) |
| `created_at` / `updated_at` | timestamps | |

- Unique (`organization_id`, `user_id`).
- Exactly one `owner` membership per organization — ownership lives only in the membership role
  (no `ownerId` column on `Organization`).

**Routes** — all JWT-protected, under `/api`:

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/orgs.json` | List the current user's organizations with their role in each (feeds the switcher) | `user-scoped` |
| POST | `/orgs.json` | Create an organization; **the requesting user becomes its owner** | `never` |
| GET | `/orgs/:orgId.json` | Organization details; 404 unless the user is a member | `user-scoped` |
| PATCH | `/orgs/:orgId.json` | Rename the organization (any member) | `never` |

Listing members is out of scope (every organization has a single member until the joining
epic).

### Edge cases (decided)

- **Denied user** — memberships are kept; the user cannot log in, so their organization simply
  sits unused. No cleanup.
- **Pending user** — the organization exists from registration but is unreachable until the
  user is approved. No special handling.
- **Registration atomicity** — user, organization and owner membership are created in **one
  transaction**; any failure rolls back all three (never a user without an organization, nor an
  organization without an owner).
- **Organization name** — trimmed; empty/whitespace-only → 400; longer than 255 characters → 400
  (no truncation); any Unicode allowed, always rendered escaped. The limit matches `User.username` (`varchar(255)`), so the auto-created name
  always fits.
- **Invalid `:orgId`** — unknown, non-numeric, or not a member → **404**, indistinguishable from
  one another. The organization id is never taken from the request body.
- **Username change** — the auto-created organization's name is set once at creation and does
  **not** follow later username edits.
- **Many organizations** — no cap on organizations per user; rate-limiting `POST /orgs.json`
  is deferred (see Future epics).
- **Stale remembered organization** — if the browser's last-used organization returns 404, the
  UI forgets it and falls back to the user's first organization.
- **Concurrent renames** — last write wins; no optimistic locking.

### Scope (decided)

**In scope** — documentation only, written into the specs:

- `Organization` and `OrganizationMembership` entities in `auth` (roles stored, not enforced;
  single owner).
- Auto-created organization at registration (username as name, renamable, same transaction).
- Routes: list my organizations, create (requester becomes owner), get, rename.
- Active organization in the URL (`/api/orgs/:orgId/...`, `/orgs/:orgId/...`), switcher,
  last-used fallback and zero-organizations empty state.
- The new data-ownership rule (organization-scoped vs user-scoped modules) and the
  `data-access` checks — **described in the specs**; `product.md` and
  `.claude/agents/data-access.md` themselves are updated when the specs are folded into the
  permanent docs, following the spec lifecycle.
- A **"Future epics"** section in the banking specs, and the `docs/agents/specs.md` lifecycle
  change (create an epic per entry before a spec is removed).
- `docs/agents/specs/banking/README.md` index entries updated; every touched file keeps its
  **Reference** and **Required tests** sections.

**Out of scope**:

- Organization permission system (role enforcement) — Future epics.
- Joining organizations: invites, accept, leave, transfer ownership, listing members — Future
  epics.
- Closing/deleting organizations and the fate of their data — Future epics.
- Backfill migration (no production data).
- Moving any module other than `bank` to organization scope.
- Any code — implementation happens after the specs are agreed.

### Security (decided)

- **Authentication** — every organization route requires the JWT guard (only `approved` users
  are authenticated, as today).
- **Single membership check** — one guard/service resolves `:orgId`, verifies the current
  user's membership and answers **404** otherwise; every organization-scoped route (including
  `bank`'s) goes through it, so the check cannot be forgotten per route.
- **No client-supplied ids or roles** — `organizationId` comes only from the URL after the
  membership check, never from the body; `role` is never accepted as input (create always sets
  `owner`); rename accepts only `name`, unknown fields are rejected by the existing whitelist
  validation.
- **Minimal responses** — organization endpoints return only `id`, `name`, the current user's
  `role` and timestamps; never member lists or other users' ids.
- **Caching** — `GET` routes are `user-scoped` (sent with `X-Skip-Cache`, never shared by Tent);
  writes are `never`. The organization id in the URL does not make a response public.
- **XSS** — the organization name is user input and is always rendered escaped (React default;
  never injected as HTML).
- **Creation rate limit** — deferred (see Future epics).

### Owning module (decided)

- **`auth`** (always-on) owns `Organization` and `OrganizationMembership` — identity data used
  at registration and by every organization-scoped module. No new module.
- **Auto-creation** happens inside `auth`, in the registration transaction, through a direct
  call to its `OrganizationService` — **not** through the post-registration event (events are
  fire-and-forget, cannot share a transaction, and are unreliable with lazy listeners).
- `auth` **exports `OrganizationService`** (e.g. `isMember(userId, orgId)` /
  `findMembership`); other modules read memberships only through it, never by querying the
  tables.
- The **membership guard** lives in **`core`** behind a DI token implemented by `auth`, in the
  same style as `SESSION_LOOKUP`, exposed as a shared decorator (e.g. `@OrgScoped()`) that
  every organization-scoped module (starting with `bank`) applies.
- `bank` stores `organizationId` as a **logical reference** (no FK across module tables), per
  the cross-module rule in `architecture/modular-pattern.md`.
- `modules/auth.md` gains the new entities, routes and exported service when the specs are
  folded into the permanent docs.

## Benefits

- A single, agreed organization model that every bank sub-issue (#29–#33) can build on.
- Deferred work is captured in the specs and turned into epics, instead of being forgotten.
- Membership checks live in one shared guard, so no organization-scoped route can skip them.
