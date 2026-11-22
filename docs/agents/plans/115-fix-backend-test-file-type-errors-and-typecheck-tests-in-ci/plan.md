# Plan: Fix backend test-file type errors and typecheck tests in CI

Issue: [115-fix-backend-test-file-type-errors-and-typecheck-tests-in-ci.md](../../issues/115-fix-backend-test-file-type-errors-and-typecheck-tests-in-ci.md)

## Overview
Backend specs run through `@swc/jest` (no type-checking) and `nest build` excludes test sources, so `tsc --noEmit -p tsconfig.json` currently reports 17 errors in 8 test files. The backend agent fixes every error at its source (typed fixtures, explicit builder interfaces, production response types, removal of stale fake-DB logic) and adds a `typecheck` script. The infra agent then adds a per-push `backend_typecheck` CircleCI job and gates the release chain on it.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)

## Shared contracts

- `backend/package.json` gains the script `"typecheck": "tsc --noEmit -p tsconfig.json"`. It must exit 0 on the branch before the CI job is relied on.
- CircleCI's `yarn_project` job runs `npm run << parameters.script >>`, so the new workflow entry uses `script: typecheck`.
- New workflow entry name: `backend_typecheck`. It must be listed in the `requires` of `build-and-release`, `upload_proxy_files` and `upload_fe_files` (the three jobs that already require `backend_build`).
- Local equivalent: `docker-compose run --rm --no-deps ward_tests yarn typecheck` (MySQL not needed).

## Notes
- Order: backend first (the job would fail on `main` until the fixes land), infra second; both ship in the same PR.
- Docs (architect scope) to update after implementation: `docs/agents/architecture/infra.md` (job graph lines ~21–47, job table ~113–124, `circleci_ward-base:0.1.0` user lists ~101–109/142, "CI setup pattern" ~174–178, which also misses the existing `backend_build`), `docs/agents/deployment.md` (job list ~44–46, image table ~81), `docs/agents/contributing.md` (`backend/` CI row ~53, add `yarn typecheck`), `.claude/agents/backend.md` (local-command/CI mapping ~43–44). Add `backend_build` wherever it is missing too.
- Security / cache review not needed: no endpoint, auth, proxy or input-handling changes.
