# Final consistency check

Review the diff against the issue's Expected Behavior before committing:

- `git diff --stat` touches only these files: `docs/agents/specs/auth/organizations.md`,
  `docs/agents/specs/auth/README.md`, `docs/agents/specs/banking/README.md` and
  `docs/agents/specs.md`. There must be **no** change to `docs/agents/product.md`,
  `.claude/agents/data-access.md`, `docs/agents/modules/auth.md`, or anything outside
  `docs/agents/`.
- Every touched spec file still ends with `## Reference` (GitHub web URLs only; grep for
  `/Users/` and for relative `docs/` paths inside Reference) and `## Required tests`.
- Cross-file consistency:
  - The route paths in `organizations.md` match the `/api/orgs/:orgId/...` wording used in
    `banking/README.md`.
  - The cache classes match `architecture/caching.md` (`user-scoped`, `never`).
  - The four Future-epics entries are each referenced from `organizations.md`'s
    deferred list.
- Relative links resolve (`../banking/README.md#future-epics`, `../auth/organizations.md`,
  `../../specs.md`).

No product, data-access or security agent review is needed for this docs-only change. Those
reviews belong to the implementation sub-issues that build against these specs.

## Files to Change
- None. This is a review step.
