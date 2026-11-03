# SSH: frontend

The built frontend on the SSH host. Owned by [#15](https://github.com/darthjee/ward/issues/15).

## Rules

- `upload_fe_files` runs in `darthjee/vite_ward-base:0.2.0` and starts with `setup_ssh`
  ([staging.md](staging.md)).
- `deploy_frontend.sh build` produces `dist/`.
- `dist/` is uploaded to `<staging>/static/` (`SOURCE=dist/`, `DEPLOY_PATH=static/`).
- There is **no `generate_folder` step**: `upload` creates the remote folder.

## Reference

- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- Oak pipeline and deploy script: https://github.com/darthjee/oak/blob/main/.circleci/config.yml, https://github.com/darthjee/oak/blob/main/bin/deploy_frontend.sh

## Required tests

Automated:

- Frontend tests and lint (`jasmine`, `frontend-checks`) stay green.

Manual (first tag release):

- The live dir's `static/` holds the built assets and the SPA loads through the proxy.
- `upload_fe_files` runs no `generate_folder` step.
