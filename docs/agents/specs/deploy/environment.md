# Environment

Every variable and host-only file the deployment needs, grouped by where it lives. The
`SSH_KNOWN_HOSTS` guard is owned by [#15](https://github.com/darthjee/ward/issues/15); the values
are filled in manually ([provisioning.md](provisioning.md)).
[#16](https://github.com/darthjee/ward/issues/16) folds this file into `environment-variables.md`.

## CircleCI project

| Variable | Purpose | Read by |
|---|---|---|
| `DOCKER_ID_USER` | Docker Hub namespace for the base images | `bin/image.sh` (`release-image`) |
| `DOCKER_HUB_USERNAME` / `DOCKER_HUB_PASSWORD` | Docker Hub login for pushing the base images | `bin/image.sh` (`release-image`) |
| `RENDER_API_KEY` | Authenticates Render API calls | `scripts/render.sh` (`build-and-release`) |
| `RENDER_SERVICE_NAME` | Render service to deploy (defaults to `ward`) | `scripts/render.sh`, `scripts/deploy.sh` (`build-and-release`) |
| `SSH_HOST` / `SSH_PORT` / `SSH_USER` | SSH deploy host connection | `deploy_frontend.sh` (every SSH job) |
| `SSH_PRIVATE_KEY` | Deploy-only private key | `deploy_frontend.sh generate_key_file` (`setup_ssh`) |
| `SSH_KNOWN_HOSTS` | Pinned host key (`ssh-keyscan` output); empty fails `setup_ssh` | `setup_ssh` (every SSH job) |
| `SSH_REMOTE_DIR` | Live release path, swapped on release | `deploy_frontend.sh` (`copy_proxy_configuration`, `release`) |
| `SSH_REMOTE_TEMP_DIR` | Prefix of the workflow staging directory | `deploy_frontend.sh` (every SSH job) |

`CIRCLE_WORKFLOW_WORKSPACE_ID` is provided by CircleCI and suffixes the staging directory.
Per-call variables (`SOURCE`, `DEPLOY_PATH`, `TARGET`, `EXCLUDE_FROM`, `KEEP_OLD`,
`CLEANUP_MAX_AGE_MINUTES`) are set in `.circleci/config.yml`, not in the project; see
[ssh/staging.md](ssh/staging.md).

## Render service

The backend runtime variables listed in `environment-variables.md` §1, notably:

| Variable | Purpose | Read by |
|---|---|---|
| `NODE_ENV=production` | Production CORS guard | backend |
| `WARD_SECRET_KEY` (+ optional `WARD_PREVIOUS_SECRET_KEYS`) | Token signing | backend |
| `WARD_MYSQL_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_NAME` | Existing production database | backend, `migration:run:prod` (`bin/server.sh`) |
| `FRONTEND_BASE_URL` / `WARD_ALLOWED_ORIGINS` | Reset links, CORS and CSRF origins | backend |
| `WARD_EMAILS_ENABLED`, `WARD_EMAIL_*` | Outbound mail | backend |

`PORT` is injected by Render.

## SSH host files

| File | Purpose | Read by |
|---|---|---|
| `${SSH_REMOTE_DIR}/configuration/locals.php` | Proxy settings (`$backendHost` = the Render URL, `$staticRoot`, `$cacheFolder`); template `proxy/prod_configuration/locals.php.sample` | Tent; carried over by `copy_files` (`copy_proxy_configuration`) |
| `${SSH_REMOTE_DIR}/.htaccess` | Web-server rules for the release root | Web server; carried over by `copy_files` (`copy_proxy_configuration`) |

## Reference

- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- Kerghan Render deploy: https://github.com/darthjee/kerghan/blob/main/scripts/render.sh
- Epic: https://github.com/darthjee/ward/issues/10

## Required tests

Manual (first tag release):

- Every CircleCI variable above is set; a deploy with `SSH_KNOWN_HOSTS` empty fails at
  `setup_ssh`.
- The Render service boots with the listed variables and serves `live`.
- `locals.php` and `.htaccess` exist on the host before the first release and survive it.
