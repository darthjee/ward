# SSH: release

The swap of the staged release into place. Owned by [#15](https://github.com/darthjee/ward/issues/15).

## Swap

- `release` runs in `darthjee/vite_ward-base:0.2.0`, starts with `setup_ssh`, and runs **only
  after every upload job and `build-and-release` (backend live) succeed** — the new frontend and
  proxy never go live in front of an old or failed backend.
- `deploy_frontend.sh release` swaps the staging directory into `${SSH_REMOTE_DIR}`.

## Kept releases

- `KEEP_OLD=true`: the previous release stays as `${SSH_REMOTE_DIR}_old_<epoch>`.
- Pruning: kept releases are not removed automatically. Keep the last few for rollback and
  delete older `_old_<epoch>` directories by hand on the host.

## Cleanup

- `deploy_frontend.sh cleanup` runs **after** the swap.
- Decision: it uses the script's default `CLEANUP_MAX_AGE_MINUTES` (1440, i.e. 24h). The longest
  wait in a workflow (the Render watch) is about 8 minutes, so a running workflow's staging
  directory is never removed.

## Rollback

- `mv` the kept `${SSH_REMOTE_DIR}_old_<epoch>` back to `${SSH_REMOTE_DIR}` on the host, or
- re-run the workflow of the previous tag (this also redeploys that tag's backend on Render).

## Reference

- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- Kerghan pipeline: https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml
- Oak pipeline: https://github.com/darthjee/oak/blob/main/.circleci/config.yml

## Required tests

Manual (first tag release):

- `release` does not start when any upload job or `build-and-release` fails.
- After a second release, a kept `${SSH_REMOTE_DIR}_old_<epoch>` exists.
- Staging directories older than 24h are gone after `cleanup`; the current one was swapped in.
- A rollback by `mv` serves the previous release.
