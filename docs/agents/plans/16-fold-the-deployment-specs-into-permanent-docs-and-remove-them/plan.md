# Plan: Fold the deployment specs into permanent docs and remove them

Issue: [16-fold-the-deployment-specs-into-permanent-docs-and-remove-them.md](../../issues/16-fold-the-deployment-specs-into-permanent-docs-and-remove-them.md)

## Overview

Docs-only change, owned by the architect (`docs/agents/` and root files). The lasting content
of `docs/agents/specs/deploy/` moves into `docs/agents/deployment.md`, written to match what
#13, #14 and #15 actually built (`.circleci/config.yml`, `bin/image.sh`, `scripts/*.sh`,
`backend/bin/server.sh`). Then the spec folder is deleted and every reference to it is moved
to the permanent docs.

## Context

`docs/agents/specs.md` says the last sub-issue of a feature folds the spec into the permanent
docs and deletes it (lifecycle steps 3–4). #16 is the last sub-issue of Epic #10. Where the
spec and the built pipeline differ, the docs follow the pipeline:

- `upload_extension` and `copy_proxy_configuration` require `upload_proxy_files`, not the
  test jobs directly.
- `release` also requires the `vite_ward-base` matrix entries.
- The `circleci_ward-base` CI pins are still `0.1.0` until the first tag publishes `0.2.0`.
- Frontend test/lint jobs run on `darthjee/circleci_node:0.2.1`.

## Steps

- [01 — Rewrite deployment.md as the permanent deployment doc](plan/01-rewrite-deployment-md.md)
- [02 — Update environment-variables.md and the other permanent docs](plan/02-update-other-docs.md)
- [03 — Delete the spec folder and move its specs.md entry](plan/03-remove-specs.md)

## Notes

- No code, CI or script changes, so no specialist agent has work.
- Whether provisioning (Render service, SSH host) is done can't be checked from the repo. The
  "nothing exists yet" note is replaced by a pointer to the provisioning checklist, without
  saying either way.
- `cache-warmer.md` describes `warm-up-cache`/`wake-navi` CircleCI jobs that don't exist. The
  deploy specs list Navi warm-up as out of scope, so that section is corrected to match.
