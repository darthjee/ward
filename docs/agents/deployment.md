# Deployment

How Ward is released: what triggers a deploy, what each CircleCI job does, how the backend
reaches Render and the rest reaches the SSH host, how a release goes live and is rolled back,
and what the maintainer sets up by hand. This page matches `.circleci/config.yml`,
`bin/image.sh`, `scripts/deploy.sh`, `scripts/render.sh` and `backend/bin/server.sh`. Change
it in the same PR as any of them.

For the full CI job table (including test and lint jobs) and the base-image Dockerfile, see
[architecture/infra.md](architecture/infra.md). For every environment variable, see
[environment-variables.md](environment-variables.md).

## Overview

Ward ships to two targets, released together from one semver tag:

- **Render** (free tier, 512 MB) runs the NestJS backend. Render builds the backend image
  itself from the tag. CI only points the deploy branch at the tag and waits until the deploy
  is live.
- **An SSH host** serves everything else through the Tent proxy: Tent itself, the proxy
  configuration, the custom extension, and the built frontend (`static/`). CI uploads each piece
  into a staging directory for the workflow, then swaps the staged release into place in one
  step.

Out of scope for the release pipeline:

- **Navi cache warm-up.** Most of Ward's data is user-scoped, and no warm-up job runs after a
  release (see [cache-warmer.md](cache-warmer.md)).
- **TLS between the backend and MySQL.** Tracked in
  [#11](https://github.com/darthjee/ward/issues/11).

## Triggers

- Deploy jobs run **only on semver tags**: the `tags_only` anchor
  (`tags: only: /\d+\.\d+\.\d+/`, `branches: ignore: /.*/`). Branch pushes and non-semver tags
  never run a deploy job.
- Test and lint jobs run on every branch and every tag (the `all_tags` anchor), so a tag build
  runs them too.
- The `release-image` matrix also runs on every push, but `bin/image.sh` makes it a no-op unless
  the build is a tag (see [Images](#images)).

## Job graph

```
tests + lint (backend_tests, backend_integration, backend_checks,
              jasmine, frontend-checks, proxy_extension_tests)
  |
  |-- build-and-release          (+ release-production_ward-base(-arm64); Render, waits until live)
  |-- upload_proxy_files         (SSH)
  |     |-- upload_extension         (SSH)
  |     `-- copy_proxy_configuration (SSH)
  `-- upload_fe_files            (+ release-vite_ward-base(-arm64); SSH)

release  <- build-and-release, upload_proxy_files, upload_extension,
            copy_proxy_configuration, upload_fe_files,
            release-vite_ward-base(-arm64)
            (swap, then cleanup)
```

- `build-and-release`, `upload_proxy_files` and `upload_fe_files` each require all six test and
  lint jobs. A failing test or lint job blocks the whole deploy.
- `upload_extension` and `copy_proxy_configuration` require `upload_proxy_files`, so they also
  wait for the tests.
- `build-and-release` requires the `production_ward-base` matrix entries (amd64 and arm64), so
  the base image Render builds from is pushed first. `upload_fe_files` and `release` require the
  `vite_ward-base` entries, since they run in that image.
- The SSH upload jobs run in parallel with `build-and-release`.
- `release` requires **every** upload job **and** `build-and-release`. The new frontend and
  proxy never go live in front of an old or failed backend. If anything upstream fails,
  `release` never runs and the previous release keeps serving.

### Job images

| Job | Image / executor |
|---|---|
| `release-image` matrix | `machine: true` (Docker + QEMU) |
| `build-and-release` | `machine: image: ubuntu-2204:current` |
| `upload_proxy_files`, `upload_extension`, `copy_proxy_configuration` | `darthjee/tent:1.1.0` |
| `upload_fe_files`, `release` | `darthjee/vite_ward-base:0.2.0` |
| `proxy_extension_tests` | `darthjee/tent-test:1.1.0` |
| `backend_tests`, `backend_integration`, `backend_checks`, `coverage-final` | `darthjee/circleci_ward-base:0.1.0` (see below) |
| `jasmine`, `frontend-checks` | `darthjee/circleci_node:0.2.1` |

The `circleci_ward-base` jobs run on every push, but `release-image` only publishes on tags. They
therefore stay on the published `0.1.0` until the first tag build publishes `0.2.0`. Move them to
`0.2.0` after that.

## Images

### Base-image matrix

- Four images, all targets of the shared `dockerfiles/base/Dockerfile`: `ward-base`,
  `circleci_ward-base`, `production_ward-base`, `vite_ward-base`.
- The `release-image` matrix builds each one for **amd64 and arm64** through `bin/image.sh`
  (`qemu`, then `push`). Each is pushed to Docker Hub as `<version>[-arm64]` and
  `latest[-arm64]`.
- Guards in `bin/image.sh`:
  - `skip_if_not_tag`: images are only pushed from a tag build;
  - `skip_if_unchanged`: skips the push when neither `dockerfiles/base/` nor `bin/image.sh`
    changed since the previous tag;
  - `FORCE_IMAGE_BUILD` overrides `skip_if_unchanged`.

### Versioning

- The `version` file holds each base image's version (all four are `0.2.0` today).
- The `version` file and every CI pin of that image move together, in the same PR. The only
  exception is the `circleci_ward-base` pin noted under [Job images](#job-images), which waits
  for the tag that publishes the new version.
- A change to the shared `dockerfiles/base/Dockerfile` (or to `bin/image.sh`'s build args)
  affects all four targets, so it means bumping every version.

### Not published

- **No backend app image.** Render builds `dockerfiles/production_ward/Dockerfile` itself, on
  top of the published `production_ward-base`.
- **No standalone image.** The SSH host runs Tent and receives files, not images.

### Where `deploy_frontend.sh` comes from

- `deploy_frontend.sh` comes from **`darthjee/scripts:0.12.0`**. Ward keeps no copy in the
  repository.
- `vite_ward-base` copies it into `/usr/local/sbin/` (the base Dockerfile's `SCRIPTS_IMAGE`
  pin).
- `darthjee/tent:1.1.0` already ships it in `/usr/sbin/`.
- Jobs call it by name (`deploy_frontend.sh <action>`), found on `PATH`.

## Render (backend)

### Build

Render builds `dockerfiles/production_ward/Dockerfile` from the **tag branch**: CI points the
service's deploy branch at the tag, then triggers the deploy. Auto-deploy is off on the service.

### Start: `backend/bin/server.sh`

- `backend/bin/server.sh` (committed as executable, `set -e`) `cd`s to the app root, then:
  1. runs `yarn migration:run:prod`, which is
     `typeorm migration:run -d dist/database/data-source.js` (compiled JS, so production needs no
     `ts-node`);
  2. then runs `exec node dist/main.js`.
- It **fails fast**: a failed migration stops the container, so Render marks the deploy failed
  instead of serving on an unmigrated schema.
- The image uses `CMD ["bin/server.sh"]` with `ENTRYPOINT []` (which clears the
  `docker-entrypoint.sh` inherited from the node base image), run from `/home/node/app`. The
  Render Docker command is also `bin/server.sh`. The dev `migration:run` / `migration:revert`
  (ts-node) scripts are unchanged.
- Rolling back a release does not revert migrations. See
  [architecture/infra.md](architecture/infra.md#migrations-on-production-boot).

### Deploy: `scripts/deploy.sh`

`build-and-release` runs `scripts/deploy.sh update_deploy_branch`, then
`scripts/deploy.sh deploy`:

- `checkLastVersion` runs **before** the service is repointed. When HEAD is not the tag, the job
  exits 0 without touching Render.
- `deploy` triggers the deploy and **polls it until it is `live`**.
- The states `build_failed`, `update_failed`, `pre_deploy_failed`, `canceled` and `deactivated`
  all exit 1 and fail the job.

### Executor and hardening

- `build-and-release` runs on `ubuntu-2204:current`, which provides curl 7.76 or later and `jq`.
- `scripts/render.sh` calls the API with `curl --fail-with-body`, so a Render API error fails
  the job and prints the error body.
- `required_service_id` in `scripts/deploy.sh` exits 1 when no service is named
  `$RENDER_SERVICE_NAME`, instead of sending `PATCH /v1/services/` with an empty id.
- Both scripts set `pipefail`, so an API failure inside a `request | jq` pipeline fails the job.

## SSH host (proxy and frontend)

### Staging directory

- Every SSH job writes to `${SSH_REMOTE_TEMP_DIR}-${CIRCLE_WORKFLOW_WORKSPACE_ID}`, which
  `deploy_frontend.sh` computes.
- There is one directory per workflow, shared by every SSH job in it. Each upload job writes its
  own sub-path (`DEPLOY_PATH`), and `release` swaps the whole directory into place.
- `CIRCLE_WORKFLOW_WORKSPACE_ID` stays the same when a workflow is re-run, so a re-run reuses its
  staging directory.

### `setup_ssh`

Every SSH job (`upload_proxy_files`, `upload_extension`, `copy_proxy_configuration`,
`upload_fe_files`, `release`) runs the reusable `setup_ssh` command before connecting. It:

1. fails when `SSH_KNOWN_HOSTS` is empty;
2. then runs `deploy_frontend.sh generate_key_file`.

No job calls `generate_key_file` outside it, so the guard and the key setup always run together.

### `deploy_frontend.sh` actions Ward uses

| Action | Used by | Purpose |
|---|---|---|
| `generate_key_file` | every SSH job, through `setup_ssh` | Write `SSH_PRIVATE_KEY` to the key file |
| `build` | `upload_fe_files` | Build the frontend into `dist/` |
| `upload` | all upload jobs | rsync `SOURCE` to `<staging>/<DEPLOY_PATH>`, creating the remote folder |
| `copy_files` | `copy_proxy_configuration` | Copy host-only files from the live release into staging |
| `release` | `release` | Swap staging into `${SSH_REMOTE_DIR}` |
| `cleanup` | `release` | Remove stale staging directories |

Per-call variables, set inline in `.circleci/config.yml`:

| Variable | Meaning |
|---|---|
| `SOURCE` | Local path to upload |
| `DEPLOY_PATH` | Sub-path inside the staging directory |
| `TARGET` | File for `copy_files`, relative to the release root |
| `EXCLUDE_FROM` | rsync `--exclude-from` file, patterns relative to `SOURCE` |
| `KEEP_OLD` | `release`: keep the previous release instead of deleting it |
| `CLEANUP_MAX_AGE_MINUTES` | `cleanup`: minimum age of staging directories to remove (default 1440) |

The connection variables (`SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`,
`SSH_KNOWN_HOSTS`, `SSH_REMOTE_DIR`, `SSH_REMOTE_TEMP_DIR`) are CircleCI project variables; see
[CircleCI project variables](#circleci-project-variables).

### Proxy uploads

All three jobs run in `darthjee/tent:1.1.0`.

| Job | Uploads | `DEPLOY_PATH` |
|---|---|---|
| `upload_proxy_files` | Tent itself (`/var/www/html/` from the image) | release root |
| `upload_extension` | `proxy/extension/`, with `EXCLUDE_FROM=proxy/extension.exclude` | `extension/` |
| `copy_proxy_configuration` | `proxy/prod_configuration/`, then the host-only files | `configuration/` |

- **Host-only files.** `configuration/locals.php` (secrets, backend URL) and `.htaccess` exist
  only on the host, never in the repository (the repo holds `locals.php.sample`).
  `copy_proxy_configuration` copies them from the live release into staging with
  `deploy_frontend.sh copy_files`, one call each, so the swap never drops them.
- **Extension exclude.** `proxy/extension.exclude` lists `tests/`. It sits outside the uploaded
  tree, so it is never uploaded itself, and the live `extension/` has no `tests/`.

### Frontend upload

`upload_fe_files` runs in `darthjee/vite_ward-base:0.2.0`. It prepares the `frontend/` folder
(`setup_project`), runs `deploy_frontend.sh build` to produce `dist/`, then runs `setup_ssh` and
uploads `dist/` to `<staging>/static/` (`SOURCE=dist/`, `DEPLOY_PATH=static/`). `upload` creates
the remote folder itself.

### Release swap

- `release` runs in `darthjee/vite_ward-base:0.2.0`, starts with `setup_ssh`, and runs
  `KEEP_OLD=true deploy_frontend.sh release`, which swaps the staging directory into
  `${SSH_REMOTE_DIR}`.
- **Kept releases.** With `KEEP_OLD=true`, the previous release stays as
  `${SSH_REMOTE_DIR}_old_<epoch>`. Nothing prunes these automatically. Keep the last few for
  rollback and delete older ones by hand on the host.
- **Cleanup.** `deploy_frontend.sh cleanup` runs after the swap with the default
  `CLEANUP_MAX_AGE_MINUTES` (1440, so 24h). It removes `${SSH_REMOTE_TEMP_DIR}-*` directories
  older than that. The longest wait in a workflow (the Render watch) is about 8 minutes, so a
  running workflow's staging directory is never removed.

### Rollback

Either:

- `mv` the kept `${SSH_REMOTE_DIR}_old_<epoch>` back to `${SSH_REMOTE_DIR}` on the host; or
- re-run the workflow of the previous tag. This also redeploys that tag's backend on Render.

Neither reverts database migrations.

## Security

### Host-key pinning

- The SSH host's public key is pinned in the CircleCI variable `SSH_KNOWN_HOSTS` (the output of
  `ssh-keyscan`). SSH connections check the host against it (`StrictHostKeyChecking=yes`)
  instead of trusting it on first use.
- Without the variable, `deploy_frontend.sh` would fall back to `StrictHostKeyChecking=no`. The
  `setup_ssh` guard fails first, before the key file is written, so that never happens.

### Where each secret lives

| Secret | Lives in | Never in |
|---|---|---|
| Backend runtime secrets (`WARD_SECRET_KEY`, `WARD_MYSQL_*`, `WARD_EMAIL_*`, ...) | Render service environment | CircleCI, the repository |
| Proxy configuration (`configuration/locals.php`) and `.htaccess` | The SSH host only | CircleCI, the repository |
| Deploy credentials (`RENDER_API_KEY`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, Docker Hub) | CircleCI project variables | Render, the repository |

CI holds **deploy credentials only**. It never needs a backend runtime secret, and no job calls
`render.sh get_env_vars`, so the Render service's secrets are never read into or printed in CI
logs.

### SSH key and paths

- Use a **deploy-only SSH key**: a dedicated key pair for the deploy user, used for nothing else,
  limited to the deploy directories.
- Keep the staging directories (`${SSH_REMOTE_TEMP_DIR}-*`) and the kept releases
  (`${SSH_REMOTE_DIR}_old_*`) **outside the web root**, so neither is ever served.

### Cache

The Tent proxy cache holds `public` responses and per-caller `user-scoped` responses, keyed by
the hashed access token (see [architecture/caching.md](architecture/caching.md)). Resetting the
cache folder on deploy is safe: entries repopulate on the next reads.

### Known gaps

- **No TLS to MySQL**: the backend connects to the database without TLS. Tracked in
  [#11](https://github.com/darthjee/ward/issues/11).

## Releasing a version

1. On a branch, run `scripts/bump_version.sh X.Y.Z`. It sets `"version"` in
   `frontend/package.json` and `backend/package.json`, and rewrites the README's
   `**Current Version:**` / `**Next Release:**` lines if they exist. `README.md` has no such
   lines today, so always pass the version: without an argument the script reads it from the
   README's *Next Release* line and fails. The script uses BSD `sed -i ''`, so it runs as-is on
   macOS only.
2. Open a PR and merge it into `main`.
3. Tag the merge commit with the bare version (`X.Y.Z`, no `v` prefix, so it matches
   `/\d+\.\d+\.\d+/`) and push the tag. The tag build runs the tests, publishes any changed base
   images, deploys the backend and swaps in the new SSH release.

`checkLastVersion` exits without deploying when HEAD is not the tag, so tag the commit you want
to ship.

## CircleCI project variables

Set all of these under **CircleCI -> Project Settings -> Environment Variables**. The full list,
including the ones the pipeline doesn't use, is in
[environment-variables.md](environment-variables.md#4-circleci-project-variables-deploy-pipeline).

| Variable | What it is for | How to get the value |
|---|---|---|
| `SSH_HOST` | Hostname of the SSH deploy host (proxy + static files). | The hosting provider's panel. |
| `SSH_PORT` | SSH port of that host. | The hosting provider's panel (often `22`). |
| `SSH_USER` | User the deploy logs in as. | The deploy-only account on the host. |
| `SSH_PRIVATE_KEY` | Private key of that deploy-only account, written out by `setup_ssh`. | Generate a dedicated key pair (`ssh-keygen -t ed25519`), install the public key in the host's `authorized_keys`, and paste the private key here. |
| `SSH_KNOWN_HOSTS` | Pinned host key. Every SSH call then runs with `StrictHostKeyChecking=yes`. | `ssh-keyscan -p <SSH_PORT> <SSH_HOST>`. Check the fingerprint against the provider first, then paste the full output. |
| `SSH_REMOTE_DIR` | Live release path on the host. It is swapped on every release. | Absolute path the web server serves from. |
| `SSH_REMOTE_TEMP_DIR` | Prefix of each workflow's staging directory (`${SSH_REMOTE_TEMP_DIR}-<workspace id>`). | An absolute path on the same filesystem as `SSH_REMOTE_DIR`, so the swap is a plain `mv`. |
| `RENDER_API_KEY` | Authenticates the Render API calls that deploy the backend. | Render -> Account Settings -> API Keys. |
| `RENDER_SERVICE_NAME` | Render service to deploy. The default is `ward`. | The service name in the Render dashboard. |
| `DOCKER_ID_USER`, `DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD` | Publish the base images to Docker Hub. | The Docker Hub account and an access token. |

`CIRCLE_WORKFLOW_WORKSPACE_ID` is set by CircleCI itself. The Render service's own variables are
the backend runtime variables in
[environment-variables.md](environment-variables.md#1-backend-application-runtime)
(`NODE_ENV=production`, `WARD_SECRET_KEY`, `WARD_MYSQL_*` — including `WARD_MYSQL_SSL=true`,
without which the backend refuses to boot — `FRONTEND_BASE_URL` /
`WARD_ALLOWED_ORIGINS`, `WARD_EMAILS_ENABLED` and `WARD_EMAIL_*`). Render injects `PORT`.

## Provisioning checklist

One-time manual setup by the maintainer, before the first tag.

Render service:

- [ ] Runtime **Docker**, backed by this Git repository, Dockerfile
      `dockerfiles/production_ward/Dockerfile`.
- [ ] **Auto-deploy off**: CI moves the deploy branch and triggers the deploy.
- [ ] Docker command **`bin/server.sh`**.
- [ ] The backend runtime variables set (see above). The database already exists; only its
      connection variables are set.
- [ ] The MySQL host accepts TLS, and `WARD_MYSQL_SSL=true` is set (plus `WARD_MYSQL_SSL_CA`
      when its certificate is not signed by a public CA). If the host has no TLS, use an SSH
      tunnel or a TLS-capable host instead — never run production without it.
- [ ] The service name matches `RENDER_SERVICE_NAME` (default `ward`).

SSH host:

- [ ] Create a deploy-only user and key pair, and install the public key.
- [ ] Create the parent directories of `SSH_REMOTE_DIR` and `SSH_REMOTE_TEMP_DIR`, with staging
      and kept releases outside the web root. Point the web server at `SSH_REMOTE_DIR`.
- [ ] Create `${SSH_REMOTE_DIR}/configuration/locals.php` (from
      `proxy/prod_configuration/locals.php.sample`, with `$backendHost` set to the Render URL)
      and `${SSH_REMOTE_DIR}/.htaccess`.
- [ ] Run `ssh-keyscan -p <port> <host>` and store its output as `SSH_KNOWN_HOSTS`.

CircleCI:

- [ ] Set every variable in [CircleCI project variables](#circleci-project-variables).
- [ ] Push the first semver tag, then walk the checks below.

## First-release checks

Walk these after the first tag release (and after any change to the pipeline):

- A branch push or a non-semver tag runs no deploy job. On a semver tag, no deploy job starts
  before every test and lint job has passed.
- `release` starts only after all four upload jobs and `build-and-release` succeed, and does not
  start when any of them fails.
- Docker Hub holds `<version>` and `<version>-arm64` for all four base images. A later tag with
  no change under `dockerfiles/base/` or `bin/image.sh` skips the pushes.
- Render reports the deploy `live`, and `build-and-release` succeeds only then. The Render logs
  show the migrations running before the server starts. A wrong `RENDER_SERVICE_NAME` or an
  invalid `RENDER_API_KEY` fails `build-and-release` with a clear error.
- With `SSH_KNOWN_HOSTS` empty, every SSH job fails at `setup_ssh`, before any connection. With
  a wrong host key, the connection is refused.
- All uploads of one workflow land in the same `${SSH_REMOTE_TEMP_DIR}-<workspace id>`
  directory.
- The live directory holds the preserved `configuration/locals.php` and `.htaccess`, has
  `extension/` but no `extension/tests/` and no `extension.exclude`, and its `static/` holds the
  built assets. The SPA loads through Tent 1.1.0.
- After a second release, a kept `${SSH_REMOTE_DIR}_old_<epoch>` exists, and a rollback by `mv`
  serves the previous release. Staging directories older than 24h are gone after `cleanup`.
- Neither a staging directory nor a kept release is reachable over HTTP. No CI log prints a
  backend runtime secret. A user-scoped response is not served from the proxy cache.

## Reference

- Epic: https://github.com/darthjee/ward/issues/10 (sub-issues #12 to #16)
- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- Tent image shipping the script: https://github.com/darthjee/tent/blob/main/dockerfiles/tent/Dockerfile
- Closest precedent (Render + SSH + base-image matrix): https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml
