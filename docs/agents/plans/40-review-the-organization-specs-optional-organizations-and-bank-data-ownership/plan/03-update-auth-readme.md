# Update the auth specs README

Align `docs/agents/specs/auth/README.md` (the index of the auth specs) with step 01.

- **Overview**: `bank` no longer scopes its data to organizations only. Say that its data
  belongs to either the user or an organization, and that organizations remain a general
  `auth` concept.
- **Purpose**: mention that #40 revised the decisions from #28.
- **Scope (in)**:
  - Replace "the automatic organization created for each user" with "optional organizations
    (none created at registration) and the active context".
  - Replace "the new organization-scoped data-ownership rule" with "the
    user-or-organization-owned data-ownership rule and the `@OwnerScoped()` owner-context
    guard".
- **Decisions**:
  - Remove the auto-creation bullet. Replace it with: organizations are optional, zero
    organizations is the normal state, and users create them through `POST /orgs.json`.
  - Replace "The active organization lives in the URL" with the active context: Personal
    (`/api/<module>/...`) or an organization (`/api/orgs/:orgId/...`).
  - Replace "Domain data can be scoped to organizations" with "Domain data can be
    user-or-organization-owned (exactly one owner per record)", still linking
    `organizations.md#data-ownership`.
- **Index**: update the `organizations.md` concern text (no auto-created organization; add
  active context, the user-or-organization-owned rule and the owner-context guard).
- **Sub-issue map**: add a #40 row for `organizations.md` and this `README.md`.
- **Reference**: add the #40 issue URL.

## Files to Change
- `docs/agents/specs/auth/README.md` — overview, scope, decisions, index text, #40 map row and
  reference updated to match the revised `organizations.md`
