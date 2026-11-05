# Write the organizations definition

Rewrite `docs/agents/specs/auth/organizations.md` from skeleton to the agreed definition. Take
the content from the issue's **Solution** section, written as decisions in prose, bullets and
tables. Name existing code only to point at a convention (`SESSION_LOOKUP`, `@CachePolicy`,
the whitelist `ValidationPipe`).

Remove the "Skeleton written by #27 … open question for #28" note and the `Open questions`
checklist; every item in it is now answered. Keep the "Owned by #28" provenance in a short
status line, e.g. "Defined by #28; skeleton by #27".

Suggested section order:

1. **Summary.** Two entities in `auth`. Roles are stored but not enforced. There is exactly
   one owner. An organization is auto-created at registration. The active organization lives
   in the URL. Bank data is organization-scoped.
2. **Permissions.** Roles are `owner` / `admin` / `user`, stored but not enforced. Every member
   can do every in-scope action. The creator gets `owner`. The global `is_admin` grants no
   organization access. There is no cross-organization access. The permission matrix is
   deferred to Future epics, which needs no migration.
3. **Ownership.** There is exactly one owner at all times. Ownership lives only in the
   membership role (no `ownerId` column). State the target behaviour: any non-owner may leave;
   the owner cannot leave and must transfer ownership or close; transfer and close are
   owner-only. Say explicitly that none of these actions exists in this scope: they come with
   the joining and closing epics. The only organization actions in scope are **create** and
   **rename**.
4. **Auto-created organization.** It is named after the username and is renamable. It is
   created in the same transaction as the account, including for `pending` users. It is a
   normal organization (no "personal" flag) and can be closed. A user may have zero
   organizations: the UI shows an empty state. This state cannot be reached yet, but the UI
   still handles it.
5. **Joining.** Deferred. Until then, every organization has exactly one member, its owner.
6. **Active organization.** API routes are `/api/orgs/:orgId/...` and UI routes are
   `/orgs/:orgId/...`. The switcher navigates between them. Membership is verified on every
   request. Explain the cache-key and multi-tab benefits. When the URL has no organization, use
   the last-used one (stored in the browser), then fall back to the first by creation date,
   then to the zero-organizations empty state.
7. **Backfill.** Not needed, because there is no production data. Dev databases are reset.
8. **Data ownership.** Organization-scoped modules (`bank`) store a logical `organizationId`.
   User-scoped modules (the existing ones plus `protocol`, `car-performance`, `links`) keep
   `userId`. Each module page states its kind, and a module never mixes both. `is_admin`
   covers accounts only. Data outlives its creator's membership. Include the new
   **`data-access` checks** for organization-scoped modules: filter by `organizationId`, verify
   membership on every `/api/orgs/:orgId/...` route, never trust a URL or body `organizationId`
   without that check, and answer 404 to non-members. State that `product.md` and
   `.claude/agents/data-access.md` are updated only at fold time.
9. **Entities.** Two tables, copied from the issue: `Organization` / `organizations` and
   `OrganizationMembership` / `organization_memberships`. Add the unique
   (`organization_id`, `user_id`) constraint and the one-`owner`-per-organization invariant.
   Note that the two FKs are inside `auth`, so they are real FKs, unlike `bank`'s logical
   `organizationId`.
10. **Routes.** The table of the four JWT-protected routes, with method, path, purpose and
    cache class: `GET`/`POST /orgs.json`, `GET`/`PATCH /orgs/:orgId.json`. Also give the
    response shape: `id`, `name`, the current user's `role`, and timestamps. Listing members
    is out of scope.
11. **Edge cases.** Copy every case from the issue: denied user, pending user, registration
    atomicity, name validation (trim, empty → 400, more than 255 characters → 400, Unicode
    allowed, rendered escaped), invalid `:orgId` → 404 that cannot be told apart from the
    other 404s, a username change does not rename the organization, no cap on the number of
    organizations, a stale remembered organization, and last-write-wins renames.
12. **Security.** The JWT guard. A single membership guard. No client-supplied `organizationId`
    or `role`. Rename accepts only `name`, and the whitelist rejects unknown fields. Minimal
    responses. Caching: `GET` is `user-scoped`, writes are `never`, and an organization id in
    the URL does not make a response public. XSS: names are rendered escaped. The rate limit
    is deferred.
13. **Owning module.** `auth` owns both entities, so there is no new module. Auto-creation is
    a direct call to `OrganizationService` inside the registration transaction, not the
    post-registration event, and the spec explains why. `auth` exports `OrganizationService`
    (`isMember` / `findMembership`). The membership guard lives in `core` behind a DI token
    implemented by `auth`, the same pattern as `SESSION_LOOKUP`, exposed as `@OrgScoped()`.
    `bank` uses a logical reference. `modules/auth.md` changes at fold time.
14. **Out of scope / deferred.** A short list linking to the `## Future epics` section in
    `../banking/README.md#future-epics`, added by Step 03.
15. **Reference.** Keep it and extend it, with GitHub web URLs only: Epic #26, #27, #28,
    `product.md`, `modules/auth.md`, `architecture/modular-pattern.md`,
    `architecture/caching.md`, `.claude/agents/data-access.md` and `docs/agents/specs.md`.
16. **Required tests.** Replace `TBD — defined by #28` with concrete tests for the
    implementation sub-issues, grouped by layer:
    - **Backend:**
      - Registration creates the user, the organization (named after the username) and the
        `owner` membership. A forced failure rolls back all three.
      - A `pending` user also gets an organization.
      - `POST /orgs.json` makes the requester `owner` and ignores or rejects `role` and
        `organizationId` in the body.
      - The name is trimmed. Empty, whitespace-only or longer than 255 characters → 400.
        Exactly 255 characters → OK.
      - `GET`/`PATCH /orgs/:orgId.json` return 404 for an unknown id, a non-numeric id and a
        non-member, with identical bodies.
      - A global admin who is not a member gets 404.
      - Rename rejects unknown fields.
      - Responses contain only `id`, `name`, `role` and timestamps.
      - `GET` routes send `X-Skip-Cache` / `user-scoped`, and writes are `never`.
      - The unique (`organization_id`, `user_id`) constraint holds.
      - A username change does not rename the organization.
      - `@OrgScoped()` returns 404 for a non-member on any route it decorates.
    - **Frontend:**
      - The switcher lists the user's organizations and navigates to `/orgs/:orgId/...`.
      - With no organization in the URL, the UI uses the last-used organization, then the
        first by creation date.
      - A stale remembered organization (404) is forgotten and the UI falls back.
      - With zero organizations, the UI shows the empty state.
      - The organization name is rendered escaped.

## Files to Change
- `docs/agents/specs/auth/organizations.md` — skeleton replaced by the full agreed
  definition, with `Reference` and `Required tests` kept and filled in.
