# Update the spec indexes

Bring the two spec indexes in line with the now-defined `organizations.md`. Following the
convention #27 set, change only the rows and bullets that concern #28. Leave other
sub-issues' rows alone.

`docs/agents/specs/banking/README.md`:

- **Index / Sub-issue map**: in the #28 row, describe what `auth/organizations.md` now
  defines: entities and routes, single owner, roles stored but not enforced, auto-created
  organization, active organization in the URL, data-ownership rule, security. Add
  `README.md` (`## Future epics` only) to the files #28 touches.
- **Decisions**: change the "Bank data is scoped to organizations … only **announced** here"
  bullet to say the rule is now **specified** in `auth/organizations.md`. Bank records carry a
  logical `organizationId`, every bank route is under `/api/orgs/:orgId/bank/...` and uses
  `@OrgScoped()`, and the fold of #26 still applies the rule to `product.md`.
- Add a link to `## Future epics` near the Index, so readers find it.

`docs/agents/specs/auth/README.md`:

- **Index**: update the `organizations.md` concern cell to match its new sections: entities,
  roles (stored, not enforced), ownership, auto-created organization, active organization,
  data ownership, routes, edge cases, security, owning module. Remove "invites" and
  "backfill" as open topics. Invites are deferred and backfill is not needed.
- **Purpose / Decisions**: replace the "#28 refines …" and "change is only announced" wording
  with the decided state. Link to `../banking/README.md#future-epics` for the deferred
  concerns.
- Keep `## Reference` and `## Required tests` ("None for this index …") unchanged, apart from
  any new reference URL.

## Files to Change
- `docs/agents/specs/banking/README.md` — #28 sub-issue-map entry, data-ownership Decisions
  bullet, and a link to Future epics.
- `docs/agents/specs/auth/README.md` — `organizations.md` index entry, plus the Purpose and
  Decisions wording.
