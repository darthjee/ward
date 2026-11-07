# Issue: Implement organizations — backend

## Description

Implement organizations in the always-on `auth` module, plus the owner-context machinery in
`core` that every user-or-organization-owned module (starting with `bank`) uses: the
`@OwnerScoped()` guard, dual-prefix mounting, `OwnerContext` and `ownerWhere()`.

Part of Epic #26. This is the first implementation issue, and it depends on nothing. The specs
are the source of truth: build against them and do not re-decide anything they settle. When a
spec is unclear or wrong, raise it on the issue instead of deviating silently.

- `docs/agents/specs/auth/organizations.md` (all of it, including *Required tests*)
- `docs/agents/specs/auth/README.md`

## Problem

- Organizations do not exist yet. Every bank issue (#48 onwards) needs records owned by **either
  a user or an organization**, served under both `/api/<module>/...` and
  `/api/orgs/:orgId/<module>/...`, with the owner resolved safely on every request.
- Existing building blocks don't fit as they are:
  - `ParseIntPipe` answers 400 for a non-numeric id, but the spec requires a uniform 404.
  - The global `ValidationPipe` (`main.ts`, `whitelist: true`) **strips** unknown fields, but
    the spec requires 400.
  - The `data-access` reviewer (`.claude/agents/data-access.md`) still assumes "every domain
    record belongs to one user", so reviews of the bank issues would apply the wrong rules.
- Tent caches 2xx `*.json` responses keyed by the query string only. Personal owner-scoped URLs
  (and `/api/orgs.json`) are identical for every user, so a single missing `X-Skip-Cache` would
  leak one user's data to another.

## Expected Behavior

- **Registration** creates the user only: no organization and no membership.
- **`POST /api/orgs.json`** creates an organization; the requester becomes its `owner`.
- **`GET /api/orgs.json`** lists the caller's organizations with their role in each.
- **`GET` / `PATCH /api/orgs/:orgId.json`** show or rename an organization, for members only.
- **Request validation**:
  - `name` is trimmed (JS `trim()`) and limited to 255 characters, counted as code points.
  - Empty, whitespace-only or too-long names → 400.
  - Names with control characters (e.g. `\u0000`) → 400.
  - `PATCH` with no `name` → 400.
  - Unknown fields (e.g. `role`, `organizationId`) → 400.
- **Responses** contain exactly `id`, `name`, `role`, `created_at` and `updated_at`.
- **Uniform 404** — the same 404 body for:
  - an unknown `:orgId`;
  - a non-member, including a global admin who is not a member;
  - a malformed `:orgId`: anything outside `^[1-9][0-9]*$`, or above 2147483647 (`abc`, `007`,
    `-1`, `1.5`, `1e3`, `99999999999`).
- **Owner-scoped routes** — a controller declared with `@OwnerScopedController('<path>')`
  answers under both prefixes:
  - personal: the owner is always the JWT user;
  - organization: membership is checked on every request, with the uniform 404 otherwise.

  Handlers receive an `OwnerContext` through `@CurrentOwner()`.
- **Caching**:
  - org GETs are `user-scoped` with `X-Skip-Cache`;
  - writes are `never`;
  - owner-scoped routes default to `user-scoped` and can never be `public`.
- **Existing routes are unchanged**: the global pipe, admin routes and `serializeUser()`.

## Solution

### Entities and routes (`auth`)

- Migration for `Organization` (`organizations`: `id`, `name` `varchar(255)` not unique,
  timestamps) and `OrganizationMembership` (`organization_memberships`: real FKs to
  `organizations` and `users`, `role` `owner` / `admin` / `user`, timestamps).
  - Unique `(organization_id, user_id)`.
  - `role` is stored, not enforced, and stays distinct from Ward's global `User.isAdmin`.
- No auto-created organization and no backfill. Create and rename are the only organization
  actions.
- One owner per organization: no extra DB enforcement (partial index, role check constraint)
  here. The invariant holds because `POST /orgs.json` is the only way to create a membership.
- `OrganizationService` (exported) implements `isMember` / `findMembership`. Other modules never
  query the tables directly.
- `serializeOrganization(org, role)`, following `serializeUser()` in `auth/auth-response.ts`,
  returns exactly the five keys. Entities are never returned directly.
- The org controller declares `@CachePolicy` explicitly (GET `user-scoped`, writes `never`). It
  uses the strict pipe and `parseOrgId()`, but it is **not** owner-scoped (it is the
  organization itself).
- Organization names are never logged; ids only.

### Owner-context machinery (`core`)

This follows the existing patterns: `@AdminOnly()` (metadata read by a global guard) and
`SESSION_LOOKUP` (a port in `core`, implemented and exported by `auth`).

- **Port `ORGANIZATION_MEMBERSHIP_LOOKUP`** (`isMember(userId, orgId): Promise<boolean>`):
  - implemented by `OrganizationService` and exported by `AuthModule`, so `core` never imports
    `auth`;
  - one indexed lookup on the unique `(organization_id, user_id)` key, without first checking
    that the organization exists, so the cost is the same and organizations cannot be
    enumerated;
  - no caching between requests;
  - no bypass for the global admin.
- **Global `OwnerContextGuard`** — the fourth `APP_GUARD`, after `JwtGuard`. It does nothing on
  routes without owner-scoped metadata. Lazy modules are covered too: their controllers are
  registered at boot, and only their services load lazily.
- **`OwnerContext`** is `{ kind: 'user', userId }` or `{ kind: 'organization', organizationId }`.
  The guard stores it on the request, and the **`@CurrentOwner()`** parameter decorator reads it
  (the same pattern as `@CurrentUser()`).
- **`@OwnerScopedController('<path>')`** expands to `@Controller(['<path>', 'orgs/:orgId/<path>'])`
  plus:
  - the owner-scoped metadata;
  - `@CachePolicy(CacheClass.UserScoped)`;
  - `StrictValidationPipe`.

  Mounting, scoping, cache class and strict validation therefore cannot be separated. The guard
  tells the contexts apart by whether `:orgId` is present. #48 (bank) uses this mechanism and
  does not build its own.
- **`parseOrgId()`** — the strict `:orgId` rule, shared by the guard and the org routes.
- **`StrictValidationPipe`** — whitelist + `forbidNonWhitelisted` + `transform`. The global pipe
  stays unchanged.
- **`ownerWhere(ctx)`** — a pure helper that returns `{ userId: X, organizationId: IsNull() }`
  or `{ userId: IsNull(), organizationId: Y }`. Every bank query filters through it.
- Guard 404s carry no cache headers, because guards run before `CachePolicyInterceptor`. That is
  safe: Tent stores only 2xx.

### `data-access` reviewer

- Update `.claude/agents/data-access.md` with the user-or-organization-owned checks from
  `auth/organizations.md`, linking the active spec:
  - every query is filtered via `OwnerContext` / `ownerWhere()`;
  - personal routes use the JWT user only;
  - every org route verifies membership;
  - no owner fields are read from input or written to output;
  - identical 404s.
- This deliberately departs from the spec's "update at fold time", so that the reviews of #46,
  #48 and the other bank issues use the right rules. The fold (#58) repoints it at the permanent
  docs.

### Tests

- The spec's *Required tests* for organizations and for the guard.
- A **test-only owner-scoped controller** (test code only, never registered in the app), mounted
  under both prefixes. It covers:
  - personal → the JWT user;
  - organization → the membership check;
  - identical 404s for unknown, malformed and non-member `:orgId`;
  - the global admin → 404.
- Unit tests for `parseOrgId()`, `ownerWhere()`, `StrictValidationPipe` and the exact
  serializer keys.
- A test that fails if any owner-scoped route resolves to `public`.
- No test-only entity or table.

### Out of scope

- The frontend: #47.
- Joining, inviting, leaving, closing, role permissions and a creation rate limit: Future epics.
- Record-level tests that need a real owner-scoped record, which move to #48:
  - the DB check rejecting both owners or neither;
  - wrong context → 404;
  - owner fields rejected in the body and absent from responses;
  - personal routes `user-scoped` with `X-Skip-Cache`;
  - a global admin getting no other user's personal data.
- Permanent docs (`modules/auth.md`, `product.md`): #58.
- Per-user caching: #60.
- Cache invalidation on writes, including `/api/orgs.json` after create / rename: #61.

### Acceptance criteria

- The tests above pass with Jest. Lint passes.
- `@OwnerScopedController` / `@OwnerScoped()` work for a lazy module without importing `auth`.
- The `security`, `data-access` and `cache` reviews raise no unresolved violations.

## Benefits

- One place resolves ownership, so a bank route cannot forget the membership check, the cache
  class or strict validation.
- A uniform 404 and identical query cost: no enumeration of organizations or records.
- The bank issues (#48 onwards) build on a tested foundation instead of re-deciding it.
- Reviews apply the right ownership rules from the start.
