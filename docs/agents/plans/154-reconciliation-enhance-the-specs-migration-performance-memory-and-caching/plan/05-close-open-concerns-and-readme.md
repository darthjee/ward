# Close the #154 open concerns and sync the README

Once steps 01-04 have landed, remove every #154 provisional marker and leave the #155 ones in
place.

**`security.md`**
- In `## Open concerns`:
  - delete the `Backward compatibility and migration (#154)` and `Performance (#154)` bullets;
  - update the intro to say that roles, security and data access were settled by #153, and
    migration, performance, memory and caching by #154;
  - keep the two #155 bullets unchanged.
- Update the file's opening sentence if needed, so that it lists migration and performance among
  the decided topics.
- Add a short `### Review (#154)` note next to `### Security review (#153)`, saying:
  - the `backend` specialist confirmed the migration, queries, indexes and memory;
  - the `cache` specialist confirmed the cache classes, invalidation and Navi.

**`README.md`**
- `## Delivery`, phase 2: say that #154 settled migration, performance, memory and caching, and
  that only #155 remains.
- `## Open concerns`: list only the #155 items.
- `## Index`: update the descriptions if the sections changed. For example, `model.md` now also
  covers "queries and indexes", and `security.md` covers "memory".
- `## Testing overview`: make sure the `Migration and entity` row still points to
  `model.md#required-tests`, and that `Ownership, bounds, cache` covers the new invalidation test.

**Consistency pass across all spec files**
- Run `grep -rn "#154\|provisional" docs/agents/specs/reconciliation`. Afterwards, only the #155
  concerns may remain marked provisional.
- Check that the migration name, the index names, the cache classes and the query counts are
  stated identically in every file that mentions them.
- Check that every relative link and anchor resolves: `model.md#migration`,
  `security.md#memory`, `api/existing-routes.md#caching`.

## Files to Change
- `docs/agents/specs/reconciliation/security.md`: remove the #154 open concerns, update the
  intro, add the #154 review note.
- `docs/agents/specs/reconciliation/README.md`: update `Delivery`, `Open concerns`, `Index` and
  `Testing overview`.
- Any other file in `docs/agents/specs/reconciliation/`: fix the wording or links found in the
  consistency pass.
