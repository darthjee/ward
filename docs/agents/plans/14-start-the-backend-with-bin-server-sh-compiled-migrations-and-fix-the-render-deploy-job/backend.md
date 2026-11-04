# Backend Plan: Start the backend with bin/server.sh (compiled migrations) and fix the Render deploy job

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce `backend/bin/server.sh`, mode `100755`: `#!/bin/sh`, `set -e`, `cd "$(dirname "$0")/.."`,
  `yarn migration:run:prod`, `exec node dist/main.js`.
- Produce the `backend/package.json` script `"migration:run:prod": "typeorm migration:run -d dist/database/data-source.js"`.
- `infra` relies on both: the production image runs `CMD ["bin/server.sh"]` from `/home/node/app`.

## Implementation Steps

### Step 1 — Add the `migration:run:prod` script
Add `"migration:run:prod": "typeorm migration:run -d dist/database/data-source.js"` to `backend/package.json`
scripts, next to the existing `migration:run` / `migration:revert`. Keep the dev ts-node scripts unchanged.
This runs without ts-node:
- `src/database/data-source.ts` already uses `dist/**/*.entity.js` and `dist/database/migrations/[0-9]*.js`
  globs, imports only `dotenv/config` and `reflect-metadata`, and uses no `__dirname` or `import.meta`.
- `tsconfig` `rootDir ./src` / `outDir ./dist` emits `dist/database/data-source.js`.
- The package is `"type": "module"`, so TypeORM 0.3 loads it via `import()`.
- `typeorm`, `dotenv`, `mysql2` and `bcryptjs` are production dependencies.

If a container is available, verify it: `docker-compose run --rm ward_tests sh -c "yarn build && yarn migration:run:prod"`
against the dev MySQL. Never run it on the host.

### Step 2 — Add `backend/bin/server.sh`
Create the boot script, following Oak's `source/bin/server.sh` (linked from `docs/agents/specs/deploy/render.md`):

```sh
#!/bin/sh
set -e

cd "$(dirname "$0")/.."

yarn migration:run:prod
exec node dist/main.js
```

- `set -e` makes a failed migration stop the boot with a non-zero exit.
- `exec` lets node receive Render's signals as PID 1's replacement.
- The `cd` makes the relative globs work regardless of the caller's cwd.
- The script never creates the database.

Commit it executable: `git add backend/bin/server.sh && git update-index --chmod=+x backend/bin/server.sh`,
then confirm `git ls-files -s backend/bin/server.sh` shows `100755`.

## Files to Change
- `backend/package.json`: add the `migration:run:prod` script.
- `backend/bin/server.sh` (new, mode 755): production boot script.

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)

## Notes
- No spec changes are expected. ESLint covers only `src`, so `bin/server.sh` is not linted. Jest coverage already
  excludes `database/**`.
- Seed migrations marked `skipInProduction` depend on `STAGE=production` being set on Render. That is already
  documented in the deploy specs, so nothing changes here.
