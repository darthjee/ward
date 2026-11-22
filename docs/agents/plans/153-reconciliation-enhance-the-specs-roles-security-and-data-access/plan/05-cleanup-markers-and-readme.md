# Clean up the markers and the README

Finish the pass so that no provisional marker remains for roles, security or data access, and
the open concerns owned by #154 and #155 are left as they are.

- `grep -n -i provisional docs/agents/specs/reconciliation`. The only matches left should belong
  to migration, performance, mismatch surfacing and checkpoint anchors.
- `security.md` § Open concerns:
  - Rewrite the intro so it no longer says every concern is pending.
  - Keep only the #154 concerns (backward compatibility and migration, performance) and the
    #155 concerns (mismatch surfacing, checkpoint anchors). Note which issue settles each one.
- `README.md`:
  - § Open concerns: drop roles and the account-list fields from the list, and link #154 and
    #155 for what remains.
  - § Delivery, phase 2: mention that #153 settled roles, security and data access.
- Re-read every touched file end to end, and check that:
  - the cross-file anchors still resolve;
  - the Reference sections use GitHub web URLs only;
  - every file still ends with Required tests.
- Run the `security` and `data-access` reviewers again on the edited files, to confirm that
  their findings are resolved. If they report anything new, fix it and run them again.

## Files to Change

- `docs/agents/specs/reconciliation/security.md` — Open concerns trimmed to the #154 and #155 items
- `docs/agents/specs/reconciliation/README.md` — Open concerns summary and phase-2 note updated
