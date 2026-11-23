# Plan: Reconciliation — create the implementation issues

Issue: [156-reconciliation-create-the-implementation-issues.md](../../issues/156-reconciliation-create-the-implementation-issues.md)

## Overview

Phase 3 of epic [#85](https://github.com/darthjee/ward/issues/85). Turn the finished specs in
`docs/agents/specs/reconciliation/` into five standalone implementation issues (three backend,
two frontend) and link them to #85 as native GitHub sub-issues, ordered before the fold issue
#157. Then replace the TBD rows of the README's `Sub-issue → file map` with the real issue
numbers, the confirmed file lists and the dependencies. The only repository change is to that
README. Everything else happens on GitHub.

## Context

- The specs are final: #152 to #155 are closed, and `README.md` § Open concerns says "None remain".
- #85's current sub-issues are #152 to #155 (closed), #156 (this issue) and #157 (fold, open).
  The fold is **not** recreated here.
- No cache/Navi issue: the specs say Navi warms nothing (every new GET is user-scoped) and
  `navi/navi_config.yaml` needs no change.
- Dependency order: **1 → (2, 3) → 4 (needs 2), 5 (needs 3)**, then #157 (needs all five). All
  the backend issues come before the frontend ones.
- Each sub-issue must stand alone. It names its spec files, the **Required tests** sections it
  must satisfy, its dependencies, and the specialist that owns it. It should follow
  `docs/agents/arcanum-split-issue.md` (granularity, standalone clarity, shared contracts,
  sequencing, responsible agents).
- Tooling: the interactive `/arcanum-split-issue` asks for confirmation, so this plan uses its
  non-interactive scripts directly (`create_sub_issue_file.sh` and `create_sub_issue.sh` in the
  `arcanum-split-issue` skill folder). `spawn_issue.sh --as-subissue` creates the issue, links it
  to the parent as a native sub-issue, and applies the parent's labels minus the pipeline tags,
  plus `Spawned`.

## Steps

- [01 — Draft the five sub-issue bodies](plan/01-draft-sub-issues.md)
- [02 — Create the issues, link them to #85 and order them](plan/02-create-and-link.md)
- [03 — Update the README sub-issue map](plan/03-update-readme-map.md)

## CI Checks

- None apply. The only file changed is `docs/agents/specs/reconciliation/README.md`, which no
  CircleCI job lints. Check by hand that the links in the updated table resolve.

## Notes

- Do **not** commit the local draft files (`docs/agents/issues/85_*.md`) that
  `create_sub_issue_file.sh` writes. They are scaffolding for the push. Delete them after
  step 02, or leave them untracked and remove them before the PR.
- The issue numbers are only known after step 02. Step 03 must use the numbers GitHub actually
  returned, never guessed ones.
- If a push fails partway, re-run only the missing ones. Before pushing again, check #85's
  sub-issues so that no duplicate is created.
- Security, data-access and cache reviews belong to the implementation issues (2 and 3 add or
  change endpoints), not to this one. Mention in issues 2 and 3 that they need a `security` and
  a `cache` review.
- Update the README's Delivery section, item 3, to name the five new issues and this one (#156).
