# Add the Future epics section

Add a `## Future epics` section to `docs/agents/specs/banking/README.md`, just before
`## Reference`. This one section collects every concern the bank and organization specs defer.
Add one sentence explaining the rule: these entries are **not** opened as GitHub issues now. An
epic is created for each of them before the specs are folded and removed (see
`docs/agents/specs.md`, Step 05).

Give each entry enough detail to seed an epic: a short title, what it covers, the decisions
already fixed that the epic must respect, and the spec file it comes from (here
`../auth/organizations.md`). Entries from #28:

1. **Organization permission system** — enforce the `owner` / `admin` / `user` matrix (e.g. a
   `user` cannot delete bank data), member management and the role checks. Roles are already
   stored, so the epic adds only rules, with no migration.
2. **Joining organizations** — invites by username or email, invite links, an accept step,
   plus the actions that only make sense with several members: listing members, **leaving**
   (any member except the owner) and **transferring ownership** (owner-only; the target
   becomes `owner`, the previous owner becomes `user`). The ownership rules in
   `organizations.md` are the target behaviour.
3. **Closing (deleting) organizations** — owner-only. The epic must decide what happens to the
   organization's data: hard delete with typed-name confirmation, soft delete or archive, or
   refusing while data exists. Closing is what makes the zero-organizations state reachable.
4. **Organization-creation rate limit** — cap the number of organizations created per user per
   time window, configurable through env vars, with 429 when exceeded. It is a volume limit,
   unlike the existing failure-based lockouts.

Say that the other enhancement sub-issues (#29–#33) add their own deferred concerns to this
same list. Do not add entries for them.

## Files to Change
- `docs/agents/specs/banking/README.md` — new `## Future epics` section with the four
  organization entries.
