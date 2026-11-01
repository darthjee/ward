# Plan: Fix backend_integration CI: convert Jest configs to .mjs

Issue: [7-fix-backend-integration-ci-convert-jest-configs-to-mjs.md](../../issues/7-fix-backend-integration-ci-convert-jest-configs-to-mjs.md)

## Overview
The `backend_integration` CircleCI job fails because `backend/jest.integration.config.ts` imports
`./jest.config.ts`, and that nested import goes through Node's native ESM loader, which cannot strip
TypeScript types on the CI image's Node 22.14. Following the skeleton fix (darthjee/citadel#21), both
Jest configs become plain `.mjs` ES modules typed via JSDoc, the `test:integration` script points at
the new file, the stale CircleCI comment is corrected, and every doc reference to the old file names is
updated.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)

Documentation and agent-definition references (`docs/agents/`, `.claude/agents/backend.md`) are owned
by the architect and updated as part of this issue (see "Architect follow-up" below).

## Shared contracts

- Jest config file names after this change (the only thing other agents/docs depend on):
  - `backend/jest.config.mjs` (unit + coverage config, auto-discovered by `jest`; replaces `backend/jest.config.ts`)
  - `backend/jest.integration.config.mjs` (integration config; replaces `backend/jest.integration.config.ts`)
- `backend/package.json` script names are unchanged: `test`, `coverage`, `test:integration`.
  CircleCI keeps calling `npm run test:integration`; only its body changes to
  `jest --config jest.integration.config.mjs --runInBand`.
- The integration config has no `globalSetup`; MySQL readiness is handled by a bounded retry in
  `createTestDataSource()` (`backend/src/database/tests/integration/test-data-source.ts`). The CircleCI
  comment must describe that, not a Jest `globalSetup`.

## Architect follow-up

After `backend` finishes, update the remaining references to the old file names:

- `.claude/agents/backend.md:20` — `backend/jest.config.ts` -> `backend/jest.config.mjs`
- `docs/agents/folder-structure.md:37` — `jest.config.ts` -> `jest.config.mjs`
  (consider also listing `jest.integration.config.mjs`)
- `docs/agents/architecture/backend.md:262` — `jest.integration.config.ts` -> `jest.integration.config.mjs`

Then confirm nothing is left with
`grep -rn "jest\.\(integration\.\)\?config\.ts" --exclude-dir=node_modules --exclude-dir=issues --exclude-dir=plans .`
(the issue and plan files legitimately mention the old names).

## Notes
- No security, cache, or data-access review is needed: no endpoint, auth, proxy, or user-input change.
- Trade-off accepted by the issue: the configs lose strict TS checking (JSDoc `@type` keeps editor
  completion; `tsconfig.json` only includes `src/**`, so they were never type-checked in CI anyway).
