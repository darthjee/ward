# Plan: Use deploy_frontend.sh from darthjee/scripts 0.12.0 and bump the base images

Issue: [15-use-deploy-frontend-sh-from-darthjee-scripts-0-12-0-and-bump-the-base-images.md](../../issues/15-use-deploy-frontend-sh-from-darthjee-scripts-0-12-0-and-bump-the-base-images.md)

## Overview
Replace the local `bin/deploy_frontend.sh` with the `deploy_frontend.sh` shipped in `darthjee/scripts:0.12.0`
(installed into `vite_ward-base` at `/usr/local/sbin/`, already in `darthjee/tent:1.1.0` at `/usr/sbin/`),
bump all four base images to `0.2.0` and align every pin, and adopt the script's safer features: host-key
pinning via `SSH_KNOWN_HOSTS` guarded by a new `setup_ssh` CircleCI command, `KEEP_OLD=true` on release,
a `cleanup` run after release, and `EXCLUDE_FROM` instead of deleting the extension tests on the checkout.
The deploy specs in `docs/agents/specs/deploy/` already describe this target state; the code and the
non-spec docs lag behind.

## Agents involved

- [infra](infra.md)
- [proxy](proxy.md)

Documentation (`docs/agents/`, `AGENTS.md`, `.claude/agents/infra.md`) is owned by the architect and is
described in [Documentation](#documentation-architect) below.

## Shared contracts

- **Exclude file**: `proxy/extension.exclude` (repo root-relative path, outside the uploaded
  `proxy/extension/` tree), content exactly one line: `tests/`. Produced by `proxy`; consumed by `infra`
  in the `upload_extension` job as `EXCLUDE_FROM=proxy/extension.exclude` (path relative to the job's
  `working_directory` `/home/app/app`, where the repo is checked out).
- **Script location**: `deploy_frontend.sh` on `PATH` — `/usr/local/sbin/deploy_frontend.sh` in
  `vite_ward-base:0.2.0`, `/usr/sbin/deploy_frontend.sh` in `darthjee/tent:1.1.0`. Jobs call
  `deploy_frontend.sh <action>` (no `bin/` prefix).
- **Image versions**: `ward-base`, `circleci_ward-base`, `production_ward-base`, `vite_ward-base` all `0.2.0`
  (`version` file, `Makefile` `BASE_VERSION` default, every CI pin).
- **CircleCI variables**: existing `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_REMOTE_DIR`,
  `SSH_REMOTE_TEMP_DIR`, `RENDER_API_KEY`, `RENDER_SERVICE_NAME`; new `SSH_KNOWN_HOSTS` (output of
  `ssh-keyscan -p <port> <host>`). `setup_ssh` fails when `SSH_KNOWN_HOSTS` is empty.

## Documentation (architect)

After `infra` and `proxy` finish, the architect updates the docs to match the result:

- `docs/agents/specs/deploy/` (`images.md`, `ssh/staging.md`, `ssh/proxy.md`, `ssh/frontend.md`,
  `ssh/release.md`, `security.md`, `environment.md`) — already describe the target state; verify against the
  final config and fix only if a decision changed during implementation (e.g. the source path of the script
  inside the scripts image).
- `docs/agents/architecture/infra.md` — replace the `bin/deploy_frontend.sh` reference (around L226) with the
  image-provided script; refresh image pins to `0.2.0`; mention `setup_ssh`, `KEEP_OLD`, `cleanup`,
  `EXCLUDE_FROM`.
- `.claude/agents/infra.md` — drop the `bin/deploy_frontend.sh` reference (L16); point to the image script.
- `docs/agents/folder-structure.md` — remove `bin/deploy_frontend.sh` (L13); add `proxy/extension.exclude`.
- `docs/agents/environment-variables.md` — the `SSH_*` rows (L128-131) name `bin/deploy_frontend.sh`;
  update them and add `SSH_KNOWN_HOSTS`.
- `AGENTS.md` — check for stale image pins / deploy-script mentions (none matched `bin/deploy_frontend.sh`).
- New `docs/agents/deployment.md` (operator guide; may be split into `docs/agents/deployment/*.md` with
  `deployment.md` as the index): for every deploy variable (`SSH_HOST`, `SSH_PORT`, `SSH_USER`,
  `SSH_PRIVATE_KEY`, `SSH_REMOTE_DIR`, `SSH_REMOTE_TEMP_DIR`, `SSH_KNOWN_HOSTS`, `RENDER_API_KEY`,
  `RENDER_SERVICE_NAME`) give where to set it (CircleCI project settings), what it is for, and how to get
  its value (e.g. `ssh-keyscan -p <port> <host>` for `SSH_KNOWN_HOSTS`, see `specs/deploy/provisioning.md`).
  Link to `docs/agents/specs/deploy/environment.md` instead of restating the specs. Include the rollout note:
  set `SSH_KNOWN_HOSTS` before the first tag after merge, otherwise every SSH job fails on purpose; and that
  kept `${SSH_REMOTE_DIR}_old_<epoch>` releases are pruned by hand.
- Link the new guide from `docs/agents/architecture.md` / the docs table in `AGENTS.md` if appropriate.

## Reviews

- `security` — after `infra` finishes (deploy/SSH changes, host-key pinning).
- `cache` — not needed (no API endpoint changes).
