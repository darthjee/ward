# Issue: Fix backend_integration CI: convert Jest configs to .mjs

## Description

The `backend_integration` CircleCI job fails on the `Integration tests` step (`npm run test:integration`):

```
Error: Jest: Failed to parse the TypeScript config file /home/circleci/project/jest.integration.config.ts
  TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /home/circleci/project/jest.config.ts
```

`backend_tests` passes on the same image, because `jest.config.ts` imports no other `.ts` file.

Reference fix in the skeleton project: https://github.com/darthjee/citadel/pull/21 (issue https://github.com/darthjee/citadel/issues/20).

## Problem

### Root cause

- `backend/package.json` has `"type": "module"`. Jest 29 loads `.ts` configs by registering ts-node and calling `require()`, so the compiled config is treated as ESM.
- `backend/jest.integration.config.ts` does `import baseConfig from './jest.config.ts'` (with a `@ts-expect-error TS5097` workaround). That nested import is resolved by Node's native ESM loader, not by ts-node's hooks.
- Node can strip TypeScript types itself only from 22.18 on (by default). The CI image runs **Node 22.14.0**, so the nested `.ts` import fails. Local Node 24 strips the types, so it works on the developer machine.

Reproduced: `jest --config jest.integration.config.ts --listTests` fails on the CI image (Node 22.14) with the exact error and works on Node 24.19.

A project is affected only when all of these are true:
1. `package.json` has `"type": "module"`;
2. a `.ts` Jest config imports another relative `.ts` file (a type-only `import type … from 'jest'` is fine);
3. some environment running Jest has Node < 22.18.

### Which environments are affected

Node versions per image (checked with `docker run --rm --entrypoint node <image> --version`):

| Image | Used by | Node |
|---|---|---|
| `darthjee/circleci_ward-base:0.1.0` (built from `darthjee/circleci_node:0.2.1`) | CircleCI | **22.14.0** ❌ |
| `darthjee/ward-base:0.1.0` (built from `darthjee/node:0.2.1`) | docker-compose dev | 22.21.1 ✅ |

Only CI is affected. `yarn test:integration` works in the docker-compose dev environment today.

## Expected Behavior

- `npm run test:integration` loads its Jest config and runs on any Node version that supports ESM, including the CI image's Node 22.14.
- The `backend_integration` CircleCI job passes.
- `yarn test`, `yarn coverage` and `yarn test:integration` keep working in the docker-compose dev environment (Node 22.21.1) and locally (Node 24).

## Solution

Use the same fix as the skeleton project (darthjee/citadel#21): turn both Jest configs into plain `.mjs` ES modules, keeping types through JSDoc.

1. Rename the configs with `git mv` (not copy: if `jest.config.ts` and `jest.config.mjs` both exist, Jest fails with "Multiple configurations found"):
   - `backend/jest.config.ts` → `backend/jest.config.mjs`
   - `backend/jest.integration.config.ts` → `backend/jest.integration.config.mjs`
2. `jest.config.mjs`: drop `import type { Config } from 'jest'` and type the object with `/** @type {import('jest').Config} */`. Keep the existing comments and settings.
3. `jest.integration.config.mjs`: `import baseConfig from './jest.config.mjs'`. Remove the TS5097 workaround and its comment, and type the object with JSDoc. Keep the existing comments and settings.
4. `backend/package.json`: `"test:integration": "jest --config jest.integration.config.mjs --runInBand"`. `test` and `coverage` stay unchanged (Jest finds `jest.config.mjs` on its own).
5. Update references to the old file names (`grep -rn "jest\.\(integration\.\)\?config\.ts" --exclude-dir=node_modules .`):
   - `.claude/agents/backend.md:20`
   - `docs/agents/folder-structure.md:37`
   - `docs/agents/architecture/backend.md:262`
6. Fix the outdated comment above the `backend_integration` job in `.circleci/config.yml`. It says "the suite's Jest globalSetup retries the connection", but the integration config deliberately has no `globalSetup`: the retry lives in `createTestDataSource()`.

No other files refer to the Jest configs: Dockerfiles, `docker-compose.yml`, `Makefile`, `bin/`, `scripts/`, `.circleci/` (apart from the comment above), `tsconfig*.json` and `nest-cli.json` were checked. `backend/eslint.config.mjs` already has a `files: ['**/*.{js,mjs}']` block, and `lint` only runs on `src`, so no lint change is needed.

### Trade-off

The config files lose strict TypeScript checking. JSDoc `@type` still gives editor completion, and `tsconfig.json` only includes `src/**`, so CI never type-checked them anyway.

### Alternatives considered (rejected)

- Upgrade the CI image to Node ≥ 22.18 / 24: the configs would still rely on Node stripping types itself, and the image would have to be rebuilt.
- `NODE_OPTIONS=--experimental-strip-types` in CI: a workaround for an experimental flag that prints warnings.
- Drop the integration config and use CLI flags: smallest diff, but the explanatory comments would have nowhere to go.

### Verification

- On the old Node (`darthjee/circleci_node:0.2.1`, Node 22.14), with `backend/` mounted:
  ```sh
  docker run --rm -v "$PWD/backend":/app -w /app --entrypoint sh darthjee/circleci_node:0.2.1 \
    -c 'npx jest --config jest.integration.config.mjs --listTests && npx jest --listTests | wc -l'
  ```
- Run the full suites on that image: `coverage`, `lint`, and `test:integration` against a throwaway `mysql:9.3.0` container (on a private docker network, with the `WARD_TEST_MYSQL_*` env vars).
- Run `yarn test` and `yarn test:integration` in the docker-compose dev environment (Node 22.21.1).
- The `backend_integration` CircleCI job passes.

## Benefits

- `backend_integration` CI goes green again.
- The Jest configs no longer depend on the Node version, ts-node, or Node's type stripping, so future image changes can't break them this way.
- Removes the `@ts-expect-error TS5097` workaround, and Ward stays aligned with the skeleton project (citadel).
