# Write the auth spec folder

Create `docs/agents/specs/auth/` holding the organizations concept, which belongs to the `auth`
module (other modules will reuse it), not to banking.

- `README.md` (owned by #27): overview of the auth feature extension (organizations), why it
  exists (Epic #26 bank data is scoped to organizations), scope, the decided facts
  (`Organization` owned by `auth`; `OrganizationMembership` many-to-many with `role`
  `owner`/`admin`/`user`, distinct from global `User.role` / `@AdminOnly()`; auto-created
  organization per new user), an index linking `organizations.md`, a sub-issue → file map
  (`organizations.md` → #28), and a note that it is consumed by `specs/banking/` and folds into
  `docs/agents/modules/auth/` via the fold issue of #26. Ends with `## Reference` and
  `## Required tests` (for the README itself, state that tests are defined per file — e.g.
  "None for this index; see each file.").
- `organizations.md` (skeleton by #27, owned by #28): decided facts above stated as decisions,
  the announcement that the `product.md` "every domain record belongs to exactly one user" rule
  changes to organization scoping (specified here by #28, applied by the fold issue), and an
  **Open questions** checklist: role permission matrix; number of owners per organization;
  leaving / deleting an organization; invites; the active-organization concept; backfilling
  organizations for existing users; the new data-ownership rule wording. Ends with
  `## Reference` and `## Required tests` → `TBD — defined by #28`.

## Files to Change
- `docs/agents/specs/auth/README.md` — new: auth/organizations spec overview and index
- `docs/agents/specs/auth/organizations.md` — new: skeleton owned by #28
