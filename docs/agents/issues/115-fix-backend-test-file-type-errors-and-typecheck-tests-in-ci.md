# Issue: Fix backend test-file type errors and typecheck tests in CI

## Description
Backend Jest specs compile with `@swc/jest`, which strips types without type-checking them. The production build (`nest build` with `tsconfig.build.json`) excludes `src/**/tests/**` and `*.spec.ts` / `*.e2e-spec.ts`. So type errors in backend test files are never reported anywhere: not by Jest, not by `backend_build` (added in #114), and not by lint.

## Problem
Running `yarn tsc --noEmit -p tsconfig.json` in `backend/` currently (after #143/#144) reports **17 errors in 8 test files**, up from the 10 errors in 5 files found while investigating #114. The list keeps growing because nothing catches it:

| File | Errors |
|---|---|
| `src/auth/tests/admin.controller.review.e2e-spec.ts` | 1 (TS2345, `it.each` callback arity) |
| `src/auth/tests/authorization-request.service.test-support.ts` | 2 (TS7022, TS7024, self-referencing `builder`) |
| `src/auth/tests/support/in-memory-repo.ts` | 2 (TS7022, TS2322) |
| `src/bank/tests/bill-history.spec.ts` | 2 (TS2554 wrong arg count, TS2345 stale `ProviderBill` fixture shape) |
| `src/bank/tests/calendar.e2e-spec.ts` | 2 (TS18046, `unknown` raw rows) |
| `src/bank/tests/provider-expense-accounts.e2e-spec.ts` | 2 (TS18046) |
| `src/bank/tests/support/in-memory-bank-repos.ts` | 3 (TS2339, `payingAccountId` on a union that includes `ProviderExpenseDetails`) |
| `src/bank/tests/transaction.service.spec.ts` | 2 (TS2345, `role` on a personal `OwnerContext`, out of date since #143) |

Some of these are not just typing noise. For example, `transaction.service.spec.ts` builds an `OwnerContext` shape that no longer exists after #143, and `bill-history.spec.ts` calls a function with the wrong number of arguments. The tests may be exercising something other than what they claim.

## Expected Behavior
- `tsc --noEmit -p tsconfig.json` in `backend/` (production and test sources) exits 0.
- A test-file type error introduced in any future push fails CI.

## Solution
- Fix every error above at its source: correct fixture shapes, function signatures, explicit annotations for self-referencing builders, and narrowing or typed row interfaces for raw query results. Avoid blanket `any` / `@ts-expect-error`. If a fix shows that a test was asserting the wrong thing, correct the test and keep it passing.
- Add `"typecheck": "tsc --noEmit -p tsconfig.json"` to `backend/package.json`.
- Add a per-push CircleCI job `backend_typecheck`, a `yarn_project` instance mirroring `backend_build` (`dir: backend`, same image and `requires`, `filters: *all_tags`, `script: typecheck`, `step_name: Typecheck`).
- Add `backend_typecheck` to the `requires` lists of the release-chain jobs that already require `backend_build` (`build-and-release`, `upload_proxy_files`, `upload_fe_files`), so a typecheck failure blocks a release the same way a build failure does.
- Owner: `backend` agent for the test fixes and `package.json`, `infra` agent for `.circleci/config.yml`.

### Out of scope
- The production-sources build check (`yarn build` on every push) was done in #114 (`backend_build`).
- The frontend is plain JavaScript (no `tsconfig`), so there is nothing to typecheck there.

## Benefits
- Test fixtures and helpers stay in sync with the production types they model, so a refactor like #143 can no longer silently leave stale test shapes behind.
- Catches tests that call real code with wrong arguments, which `@swc/jest` would otherwise run unchecked.
