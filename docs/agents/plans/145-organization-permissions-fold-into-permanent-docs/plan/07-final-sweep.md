# Final sweep
Confirm nothing still calls the roles unenforced or deferred to #81, and that links resolve.

- `grep -rn -i "not enforced\|stored, not enforced\|equal rights\|any member\|issues/81" docs/agents .claude/agents AGENTS.md README.md`
  (excluding `docs/agents/issues/` and `docs/agents/plans/`) — every remaining hit must be
  intentional (e.g. the specs.md folded row).
- Check every new anchor link (`#roles`, `#owner-context-mechanism`,
  `#owner-context-organizations`, `#security-rules`) resolves.
- Do not delete the issue/plan files here; that happens in the normal merge flow.
- PR body: `Closes #145` and `Closes #81`.

## Files to Change
- Any file the sweep flags
