# Render

The backend deploy to Render. Owned by [#14](https://github.com/darthjee/ward/issues/14).

## Build

- Render builds `dockerfiles/production_ward/Dockerfile` from the **tag branch**: CI points the
  service's deploy branch at the tag, then triggers the deploy. Auto-deploy is off (see
  [provisioning.md](provisioning.md)).

## Start: `backend/bin/server.sh`

- New `backend/bin/server.sh`:
  1. runs `migration:run:prod`, a new backend script:
     `typeorm migration:run -d dist/database/data-source.js` (compiled JS, no `ts-node` in
     production);
  2. then `exec node dist/main.js`.
- It **fails fast** (`set -e`): a failed migration stops the container, so Render marks the
  deploy failed instead of serving on an unmigrated schema.
- The image uses `CMD ["bin/server.sh"]` with **no `ENTRYPOINT`** (replacing today's
  `entrypoint.sh` entrypoint, which runs `yarn migration:run`). The Render Docker command is
  `bin/server.sh`.

## Deploy: `scripts/deploy.sh`

- `build-and-release` runs `checkLastVersion` **before** `update_deploy_branch`, so a tag older
  than the one already deployed is not released.
- It then triggers the deploy and **polls it until `live`**.
- Failure states: `build_failed`, `update_failed`, `pre_deploy_failed`, `canceled`,
  `deactivated` all exit 1 and fail the job (`pre_deploy_failed` is new).

## Executor and hardening

- `build-and-release` runs on `machine: image: ubuntu-2204:current` (as Kerghan), which provides
  curl ≥ 7.76 and `jq`.
- `scripts/render.sh` calls the API with `curl --fail-with-body`, so a Render API error fails the
  job and prints the error body.
- `scripts/deploy.sh` exits 1 when `service_id` finds no service named `$RENDER_SERVICE_NAME`,
  instead of sending `PATCH /v1/services/` with an empty id.

## Reference

- Kerghan Render deploy: https://github.com/darthjee/kerghan/blob/main/scripts/deploy.sh, https://github.com/darthjee/kerghan/blob/main/scripts/render.sh
- Kerghan pipeline: https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml
- Oak server start (migrate, then serve): https://github.com/darthjee/oak/blob/main/source/bin/server.sh

## Required tests

Automated:

- Backend tests and lint stay green: adding `migration:run:prod` and `bin/server.sh` must not
  break the backend suite.

Manual (first tag release):

- Render reports the deploy `live`, and `build-and-release` succeeds only then.
- The Render logs show the migrations running before the server starts.
- A wrong `RENDER_SERVICE_NAME` or an invalid `RENDER_API_KEY` fails `build-and-release` with a
  clear error.
