# Issue: Use deploy_frontend.sh from darthjee/scripts 0.12.0 and bump the base images

## Description

Part of Epic #10 (deploy Ward). Replace the repo copy `bin/deploy_frontend.sh` with the `deploy_frontend.sh` published in `darthjee/scripts:0.12.0`. The images the deploy jobs run in put it on `PATH`. Then adopt its safer features.

Build against `docs/agents/specs/deploy/images.md`, `ssh/staging.md`, `ssh/proxy.md`, `ssh/frontend.md`, `ssh/release.md`, `security.md` and `environment.md`. If a decision changes, update those specs in the same PR.

Depends on #12 (deployment specs) and #13 (Tent 1.1.0 upgrade). The proxy jobs need `darthjee/tent:1.1.0`, which ships the 0.12.0 script.

## Problem

- `bin/deploy_frontend.sh` is a local copy. It runs every SSH call with `StrictHostKeyChecking=no`, has no `set -euo pipefail` and no checks for required variables, and `release` deletes the previous release right away, so there is nothing to roll back to.
- Staging directories from failed or abandoned workflows are never removed from the host.
- `upload_extension` strips the tests with `rm -rf proxy/extension/tests/` on the checkout.
- Tag drift: `upload_fe_files` and `release` run on `darthjee/vite_ward-base:0.0.1`, which was never published (only `0.1.0` exists). The `Makefile` `BASE_VERSION` default is also `0.0.1`.

## Expected Behavior

`deploy_frontend.sh` 0.12.0 adds:
- host-key pinning through `SSH_KNOWN_HOSTS`;
- `set -euo pipefail` and checks for required variables;
- a `release` that checks the staging directory exists before touching the live directory, and accepts a missing live directory;
- `KEEP_OLD`;
- an `upload` that creates the remote folder itself;
- `EXCLUDE_FROM`;
- a `cleanup` action, which removes `${SSH_REMOTE_TEMP_DIR}-*` staging directories older than `CLEANUP_MAX_AGE_MINUTES` and keeps the current workflow's directory.

Every deploy job uses the script from the image, pins the host key, keeps the previous release for rollback and cleans up stale staging directories. All base-image pins point at tags that exist.

## Solution

### Base images

- In `dockerfiles/base/Dockerfile`:
  - bump the `scripts` stage (`SCRIPTS_IMAGE`) from `darthjee/scripts:0.8.0` to `0.12.0` (`yarn_builder.sh` is identical from 0.9.0 through 0.12.0);
  - copy `sbin/deploy_frontend.sh` into `/usr/local/sbin/` for `vite_ward-base`.
- The shared Dockerfile changes, so every base image is rebuilt. Bump all four versions in `version` to `0.2.0` and every pin to match:
  - `circleci_ward-base` in the test jobs (`backend_tests`, `backend_integration`, `backend_checks`, `coverage-final`);
  - `vite_ward-base` in `upload_fe_files` and `release`;
  - the `Makefile` `BASE_VERSION` default (`0.0.1` today).

### Deploy script

- Delete `bin/deploy_frontend.sh`. Every job calls `deploy_frontend.sh <action>` from `PATH` instead:
  - `vite_ward-base`: `/usr/local/sbin/`;
  - `darthjee/tent:1.1.0`: `/usr/sbin/`.
- `upload_fe_files`: drop the `generate_folder` step (`upload` now creates the folder itself).
- `upload_extension`: replace `rm -rf proxy/extension/tests/` with `EXCLUDE_FROM=proxy/extension.exclude`. Add `proxy/extension.exclude` (one line: `tests/`). It sits outside the uploaded tree.
- `release`:
  - run the swap with `KEEP_OLD=true`;
  - then run `deploy_frontend.sh cleanup` (default `CLEANUP_MAX_AGE_MINUTES`, 1440 = 24h).
  - `cleanup` only removes staging directories. Kept `${SSH_REMOTE_DIR}_old_<epoch>` releases are pruned by hand on the host, as `ssh/release.md` states.

### Host-key pinning

- New CircleCI variable `SSH_KNOWN_HOSTS`. When it is set, `generate_key_file` writes it out and every call uses `StrictHostKeyChecking=yes`.
- The script silently falls back to `StrictHostKeyChecking=no` when the variable is unset. So add a reusable CircleCI `command`, `setup_ssh`, that fails when `SSH_KNOWN_HOSTS` is empty and then runs `deploy_frontend.sh generate_key_file`. Every SSH job calls `setup_ssh` instead of `generate_key_file`. The SSH jobs are `upload_proxy_files`, `upload_extension`, `copy_proxy_configuration`, `upload_fe_files` and `release`.

### Documentation

- Update the deploy specs listed above if anything changes.
- Refresh the stale image pins and the deploy-script references in `docs/agents/architecture/infra.md`, `.claude/agents/infra.md`, `AGENTS.md` and `docs/agents/folder-structure.md`.
- Add an operator-facing deployment guide, `docs/agents/deployment.md`. It may be split into `docs/agents/deployment/*.md` with `deployment.md` as the index. It lists every variable the deploy needs (CircleCI project variables such as `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_REMOTE_DIR`, `SSH_REMOTE_TEMP_DIR`, the new `SSH_KNOWN_HOSTS`, plus the Render ones). For each it gives where to set it, what it is for and how to get its value (for example, `ssh-keyscan -p <port> <host>` for `SSH_KNOWN_HOSTS`). It links to `docs/agents/specs/deploy/environment.md` rather than restating the specs.
- Rollout: the maintainer sets `SSH_KNOWN_HOSTS` in CircleCI before the first tag after this merges. Until then every SSH job fails on purpose.

### Acceptance criteria

- `bin/deploy_frontend.sh` is gone, and no job references it.
- The `version` file, the `Makefile` default and every base-image pin in `.circleci/config.yml` agree. Each pinned tag exists on Docker Hub after the tag build.
- Every SSH job fails fast when `SSH_KNOWN_HOSTS` is empty.
- `release` keeps the previous release and runs `cleanup`. `upload_extension` uploads no `tests/`.
- `docs/agents/deployment.md` lists every deploy variable, including `SSH_KNOWN_HOSTS`.
- The specs listed above and the architecture docs match the result.

## Benefits

- One maintained deploy script, shared with the other darthjee projects, instead of a drifting local copy.
- SSH host-key pinning closes the man-in-the-middle gap on every deploy connection.
- Rollback is possible because the previous release is kept, and stale staging directories no longer pile up on the host.
- The CI pins point at images that actually exist.
