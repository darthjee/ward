# Plan: Start the backend with bin/server.sh (compiled migrations) and fix the Render deploy job

Issue: [14-start-the-backend-with-bin-server-sh-compiled-migrations-and-fix-the-render-deploy-job.md](../../issues/14-start-the-backend-with-bin-server-sh-compiled-migrations-and-fix-the-render-deploy-job.md)

## Overview
The production container cannot boot because `entrypoint.sh` runs the ts-node migration script after the
devDependencies are pruned. `backend` adds a compiled-JS migration script (`migration:run:prod`) and a
`backend/bin/server.sh` boot script. `infra` makes the production image run that script as its `CMD` (dropping
`entrypoint.sh`), and hardens the Render deploy job: version check before repointing the service,
`pre_deploy_failed` as a failure, `curl --fail-with-body`, an empty-service-id guard, and the
`ubuntu-2204:current` machine image. The architect then aligns the deploy docs. Build against
`docs/agents/specs/deploy/render.md`.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)

## Shared contracts

- **Boot script path**: `backend/bin/server.sh`, committed with mode `100755` (`git update-index --chmod=+x`).
  It ships into the image at `/home/node/app/bin/server.sh` via the existing `COPY ./backend/ /home/node/app/`
  (there is no `.dockerignore`).
- **Boot script behaviour**: `#!/bin/sh`, `set -e`, `cd "$(dirname "$0")/.."` (so the cwd is the app root,
  which the relative `dist/**` globs in `data-source.ts` and `dist/main.js` require), `yarn migration:run:prod`,
  then `exec node dist/main.js`. A failed migration exits non-zero. It never creates the database.
- **Package script**: `backend/package.json` `"migration:run:prod": "typeorm migration:run -d dist/database/data-source.js"`.
  It needs only production deps (`typeorm`, `dotenv`, `mysql2`, `bcryptjs`) plus `yarn build` output.
- **Image command**: `CMD ["bin/server.sh"]` with no `ENTRYPOINT`, run from `/home/node/app` (the base image's
  working directory). The Render Docker command is `bin/server.sh`.
- **Order**: backend's work must land before, or in the same PR as, infra's Dockerfile change. Otherwise the
  image would `CMD` a script that does not exist.

## Documentation (architect)

After both agents finish, update these in the same PR:
- `docs/agents/specs/deploy/render.md`: rewrite the "New `backend/bin/server.sh`" (L13), "replacing today's
  `entrypoint.sh` entrypoint" (L20–21) and "(`pre_deploy_failed` is new)" (L30) wording as current state. Fix
  the `checkLastVersion` rationale (L26–27): it exits 0 without touching Render when HEAD is not a tag.
- `docs/agents/architecture/infra.md`: rewrite "Migrations on production boot" (L228–235) to describe
  `bin/server.sh` + `migration:run:prod` + `CMD`. Change the `build-and-release` executor (L116) to
  `machine: image: ubuntu-2204:current`.
- Check `.claude/agents/infra.md` for mentions of `entrypoint.sh` and update them.

## Reviews
- `security`: this is an infra change touching deploy scripts that use `RENDER_API_KEY`. Dispatch it after
  `infra` with the changed files.
- `cache`: not needed, because no API endpoint changes.
