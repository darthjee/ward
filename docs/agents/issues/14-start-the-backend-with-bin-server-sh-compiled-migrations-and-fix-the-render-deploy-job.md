# Issue: Start the backend with bin/server.sh (compiled migrations) and fix the Render deploy job

## Description

Part of Epic #10 (deploy Ward). Make the backend start correctly on Render and make the Render deploy job reliable. Build against `docs/agents/specs/deploy/render.md`; if a decision changes, update that spec in the same PR.

Depends on #12 (deployment specs, merged). Can run in parallel with #13.

## Problem

- **The production container cannot boot.** `dockerfiles/production_ward/entrypoint.sh` runs `yarn migration:run`, which is `typeorm-ts-node-esm migration:run -d src/database/data-source.ts`. `ts-node` and `typescript` are devDependencies, and the final image removes them with `yarn install --production`. Compiling TypeScript at boot would also waste memory on Render's 512 MB free tier.
- **The deploy job is unreliable** (`scripts/deploy.sh`, `scripts/render.sh`, `.circleci/config.yml`):
  - `build-and-release` runs `update_deploy_branch` before any `checkLastVersion`, so it points the Render service at the tag before checking that HEAD is the tag.
  - `check_deployment_status` does not treat `pre_deploy_failed` as a failure, so the job keeps polling until it times out.
  - `request()` and `update_service_branch` call `curl` without `--fail-with-body`, so Render API errors (bad key, 404) do not fail the job.
  - When `service_id` finds no service named `$RENDER_SERVICE_NAME`, the job carries on with an empty id (`PATCH /v1/services/`).
  - The job runs on `machine: true`, which does not guarantee curl ≥ 7.76 (needed for `--fail-with-body`) or `jq`.

## Expected Behavior

- A container built from `dockerfiles/production_ward/Dockerfile`, pointed at a MySQL database, applies pending migrations and starts the server through `bin/server.sh`.
- A failed migration makes the container exit non-zero.
- `scripts/deploy.sh`: runs where HEAD is not the tag exit 0 without touching the Render service, and `pre_deploy_failed` fails the job.
- A Render API error, or a missing service, fails the job with a clear message.
- Backend tests and lint pass.
- `docs/agents/specs/deploy/render.md` matches the result.

## Solution

### Server start (`backend`)

- Add a `migration:run:prod` script to `backend/package.json`: `typeorm migration:run -d dist/database/data-source.js`. This works without ts-node:
  - `src/database/data-source.ts` already points `entities` and `migrations` at the compiled `dist/**` globs;
  - `typeorm` and `dotenv` are production dependencies;
  - the package is ESM (`"type": "module"`).
- Add `backend/bin/server.sh`, following Oak's `source/bin/server.sh`:
  - fail fast (`set -e`), so a failed migration stops the boot;
  - run `yarn migration:run:prod`;
  - then `exec node dist/main.js`.

  The production database already exists, so the script never creates it.
- Keep the dev `migration:run` / `migration:revert` (ts-node) unchanged.

### Image (`infra`)

- In `dockerfiles/production_ward/Dockerfile`, drop the `COPY` of `entrypoint.sh` and replace `ENTRYPOINT ["/home/node/app/entrypoint.sh"]` with `CMD ["bin/server.sh"]`. The script ships with `backend/` into `/home/node/app/` (the working directory the current `node dist/main.js` CMD already relies on) and must be committed executable.
- Delete `dockerfiles/production_ward/entrypoint.sh`.

Without an `ENTRYPOINT`, Render's Docker command (`bin/server.sh`) runs the script directly instead of being passed to the entrypoint as an argument.

### Render deploy job (`infra`)

- `scripts/deploy.sh`: `update_deploy_branch` must run `checkLastVersion` before calling `update_service_branch`, so the first step of `build-and-release` exits 0 without touching Render when HEAD is not the tag.
- `scripts/deploy.sh`: `check_deployment_status` treats `pre_deploy_failed` as a failure, alongside `build_failed`, `update_failed`, `canceled` and `deactivated`.
- `scripts/deploy.sh`: exit 1 with a clear message when `service_id` returns nothing for `$RENDER_SERVICE_NAME`.
- `scripts/render.sh`: `request()` and `update_service_branch` use `curl --fail-with-body`.
- `.circleci/config.yml`: run `build-and-release` on `machine: image: ubuntu-2204:current` (as Kerghan does), which provides curl ≥ 7.76 and `jq`; update the job comment accordingly.

## Benefits

- The production backend boots on Render with no TypeScript toolchain at runtime, keeping memory within the free tier.
- Broken migrations, API errors and failed pre-deploys fail loudly instead of silently or by timeout.
- Non-tag pipeline re-runs can no longer repoint the Render service.
