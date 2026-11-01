# Backend Plan: Fix backend_integration CI: convert Jest configs to .mjs

Main plan: [plan.md](plan.md)

## Shared contracts

- Must produce `backend/jest.config.mjs` and `backend/jest.integration.config.mjs`; the `.ts`
  versions must no longer exist (Jest fails with "Multiple configurations found" if both
  `jest.config.ts` and `jest.config.mjs` are present).
- `test:integration` must remain the script name CircleCI calls (`npm run test:integration`).

## Implementation Steps

### Step 1 — Convert both Jest configs to `.mjs`
Rename with `git mv` (not copy):
- `backend/jest.config.ts` -> `backend/jest.config.mjs`
- `backend/jest.integration.config.ts` -> `backend/jest.integration.config.mjs`

In `jest.config.mjs`: drop `import type { Config } from 'jest';`, replace `const config: Config = {`
with `/** @type {import('jest').Config} */` followed by `const config = {`. Keep every existing comment
and setting verbatim (rootDir, swc transform, moduleNameMapper, collectCoverageFrom exclusions,
coverageDirectory), and `export default config;`.

In `jest.integration.config.mjs`: remove `import type { Config } from 'jest';`, the two-line
"Jest loads config files through ts-node..." comment and the `@ts-expect-error TS5097` line; import
with `import baseConfig from './jest.config.mjs';`. Type the object with
`/** @type {import('jest').Config} */`. Keep the explanatory block comment (including the
"deliberately no `globalSetup`" paragraph) and all settings (`testRegex`, `collectCoverage: false`,
`collectCoverageFrom: undefined`, `coverageDirectory: undefined`, `testTimeout: 90_000`).

### Step 2 — Point `test:integration` at the new config and verify
In `backend/package.json` change the script to
`"test:integration": "jest --config jest.integration.config.mjs --runInBand"`. Leave `test` and
`coverage` untouched (Jest auto-discovers `jest.config.mjs`).

Verify (never on the host — always through docker):
- On the CI Node version (22.14), with `backend/` mounted:
  `docker run --rm -v "$PWD/backend":/app -w /app --entrypoint sh darthjee/circleci_node:0.2.1 -c 'npx jest --config jest.integration.config.mjs --listTests && npx jest --listTests | wc -l'`
  (the second count must match the unit spec count from before the change).
- In the docker-compose dev environment (Node 22.21.1): `yarn test`, `yarn coverage`, `yarn lint`
  and `yarn test:integration` via `docker-compose run` against the backend service.
- Confirm `backend/eslint.config.mjs`'s `files: ['**/*.{js,mjs}']` block does not need changes
  (`lint` only targets `src`).

## Files to Change
- `backend/jest.config.ts` -> `backend/jest.config.mjs` — rename; replace TS type annotation with JSDoc
- `backend/jest.integration.config.ts` -> `backend/jest.integration.config.mjs` — rename; import `./jest.config.mjs`, drop TS5097 workaround, JSDoc type
- `backend/package.json` — `test:integration` uses `jest.integration.config.mjs`

## CI Checks
- `backend`: `docker-compose run --rm <backend service> yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm <backend service> yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm <backend service> yarn test:integration` with MySQL available (CI job: `backend_integration`)

## Notes
- Use `git mv` so history follows the files and no stale `.ts` config is left behind.
- No changes under `src/`; `tsconfig*.json` and `nest-cli.json` do not reference the configs.
