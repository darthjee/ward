# SSH staging

How every SSH job stages files on the host. Owned by [#15](https://github.com/darthjee/ward/issues/15).

## Staging directory

- `${SSH_REMOTE_TEMP_DIR}-${CIRCLE_WORKFLOW_WORKSPACE_ID}`, computed by `deploy_frontend.sh`.
- One directory per workflow, **shared by every SSH job in that workflow**: each upload job
  writes its own sub-path (`DEPLOY_PATH`), and `release` swaps the whole directory into place.
- `CIRCLE_WORKFLOW_WORKSPACE_ID` is stable across re-runs of a workflow, so a re-run reuses its
  staging directory.

## `deploy_frontend.sh` actions Ward uses

| Action | Used by | Purpose |
|---|---|---|
| `generate_key_file` | every SSH job, through `setup_ssh` | Write `SSH_PRIVATE_KEY` to the key file |
| `build` | `upload_fe_files` | Build the frontend into `dist/` |
| `upload` | all upload jobs | rsync `SOURCE` to `<staging>/<DEPLOY_PATH>`, creating the remote folder |
| `copy_files` | `copy_proxy_configuration` | Copy host-only files from the live release into staging |
| `release` | `release` | Swap staging into `${SSH_REMOTE_DIR}` |
| `cleanup` | `release` | Remove stale staging directories |

## Per-call variables

| Variable | Meaning |
|---|---|
| `SOURCE` | Local path to upload |
| `DEPLOY_PATH` | Sub-path inside the staging directory |
| `TARGET` | Files for `copy_files`, relative to the release root |
| `EXCLUDE_FROM` | rsync `--exclude-from` file, patterns relative to `SOURCE` |
| `KEEP_OLD` | `release`: keep the previous release instead of deleting it |
| `CLEANUP_MAX_AGE_MINUTES` | `cleanup`: minimum age of staging directories to remove (default 1440) |

Connection variables (`SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_REMOTE_DIR`,
`SSH_REMOTE_TEMP_DIR`, `SSH_KNOWN_HOSTS`) are project-wide; see [environment.md](../environment.md).

## `setup_ssh`

- Decision: one reusable CircleCI `command`, **`setup_ssh`**, that:
  1. fails when `SSH_KNOWN_HOSTS` is empty;
  2. then runs `deploy_frontend.sh generate_key_file`.
- Every SSH job (`upload_proxy_files`, `upload_extension`, `copy_proxy_configuration`,
  `upload_fe_files`, `release`) starts with `setup_ssh` instead of calling `generate_key_file`
  directly, so the guard and the key setup can never be separated. See
  [security.md](../security.md).

## Reference

- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- `darthjee/scripts` 0.12.0 image: https://github.com/darthjee/docker/tree/main/scripts/0.12.0
- Kerghan pipeline: https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml
- Oak pipeline and deploy script: https://github.com/darthjee/oak/blob/main/.circleci/config.yml, https://github.com/darthjee/oak/blob/main/bin/deploy_frontend.sh

## Required tests

Manual (first tag release):

- With `SSH_KNOWN_HOSTS` empty, every SSH job fails at `setup_ssh`, before any connection.
- All uploads of one workflow land in the same `${SSH_REMOTE_TEMP_DIR}-<workspace id>`
  directory.
- No SSH job calls `generate_key_file` outside `setup_ssh`.
