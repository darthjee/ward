# Plan: Enhance the banking specs: organizations and memberships

Issue: [28-enhance-the-banking-specs-organizations-and-memberships.md](../../issues/28-enhance-the-banking-specs-organizations-and-memberships.md)

## Overview

Documentation-only change. Replace the `organizations.md` skeleton written by #27
(`docs/agents/specs/auth/organizations.md`) with the agreed organizations and memberships
definition from the issue, add a **Future epics** section to the banking specs, describe the
"create an epic per Future-epics entry before removing a spec" lifecycle rule in
`docs/agents/specs.md`, and update the spec index entries for every touched file. Owned by the
architect (every file is under `docs/agents/`); no specialist agent has work.

## Context

- **Dependency on #27 (not merged yet).** `docs/agents/specs/auth/` and
  `docs/agents/specs/banking/` do not exist on `main` or on this branch. They exist only on the
  local and remote `issue-27` branch (commit `124c655`, "add initial banking and auth
  (organizations) spec skeletons"). Step 01 brings them in before anything else is edited.
- Files #27 creates that this issue edits:
  - `docs/agents/specs/auth/organizations.md` — skeleton owned by #28, with `Decisions`,
    `Data-ownership rule (announced)`, an `Open questions` checklist, `Reference`, and
    `Required tests` reading `TBD — defined by #28`.
  - `docs/agents/specs/auth/README.md` — the auth spec index (Index row for `organizations.md`,
    Sub-issue map, a Decisions bullet that says the data-ownership change is only announced).
  - `docs/agents/specs/banking/README.md` — the banking index. Its sub-issue map maps #28 to
    `auth/organizations.md`, and a Decisions bullet says the data-ownership change is only
    announced. The convention #27 set is that each sub-issue edits only its own row.
- Spec conventions (`docs/agents/specs.md`): every file ends with `## Reference` (GitHub web
  URLs only, `https://github.com/darthjee/ward/...`, never local paths) and `## Required tests`.
  Specs describe decisions, not code. They name existing code only to point at the file or
  convention to change.
- Existing conventions the spec must point at, not redefine:
  - `docs/agents/architecture/modular-pattern.md`: the Core-token pattern (`SESSION_LOOKUP`) and
    logical cross-module FKs (no physical FK, no cross-module JOIN).
  - `docs/agents/architecture/caching.md`: the `user-scoped` and `never` cache classes and the
    `X-Skip-Cache` behaviour.
  - `docs/agents/product.md`: the current rule that every domain record belongs to exactly one
    user (around line 59), and the global `is_admin`.
- Hard constraints from the issue: **no code**, and **no edits** to `product.md`,
  `.claude/agents/data-access.md` or `modules/auth.md`. Those change when the specs are folded
  into the permanent docs.

## Steps

- [01 — Bring in #27's spec skeletons](plan/01-bring-in-27-skeletons.md)
- [02 — Write the organizations definition](plan/02-write-organizations-spec.md)
- [03 — Add the Future epics section](plan/03-future-epics.md)
- [04 — Update the spec indexes](plan/04-update-indexes.md)
- [05 — Describe the Future-epics lifecycle rule in specs.md](plan/05-specs-lifecycle.md)
- [06 — Final consistency check](plan/06-consistency-check.md)

## Notes

- **Where the Future epics section lives.** The issue says "the banking specs gain a Future
  epics section" but lists only organization concerns. The plan puts one shared
  `## Future epics` section in `docs/agents/specs/banking/README.md`, because the fold of #26
  handles both `specs/banking/` and `specs/auth/`. The parallel sub-issues #29–#33 then add
  their own deferred concerns to the same list. `organizations.md` and `specs/auth/README.md`
  link to it and do not keep a copy. Because the sub-issues run in parallel, expect small merge
  conflicts in that section, resolved by keeping every entry.
- **Four Future-epics entries, not two.** In the issue, "Closing (deleting) organizations" and
  "Organization-creation rate limit" are nested under the lifecycle-change bullet. That looks
  like a formatting slip. The Scope and Security sections treat both as Future epics, so the
  plan records four entries: permission system, joining (including leave and transfer
  ownership), closing, and creation rate limit.
- **FK wording.** Inside `auth`, `organization_memberships.organization_id` and `.user_id` are
  real FKs, because both tables are owned by `auth`. `bank`'s `organizationId` is a logical
  reference, because it crosses modules. The spec should state both explicitly so they are not
  confused.
- If #27's skeletons change during its review, re-read them after Step 01 and adapt the
  section and row names this plan quotes.
- No CI job validates `docs/agents/`, so there is no CI check to run.
