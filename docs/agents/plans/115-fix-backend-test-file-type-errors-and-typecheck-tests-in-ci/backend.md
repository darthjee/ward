# Backend Plan: Fix backend test-file type errors and typecheck tests in CI

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce `"typecheck": "tsc --noEmit -p tsconfig.json"` in `backend/package.json`; it must exit 0. Infra wires it into CircleCI as `npm run typecheck`.

## Steps

- [01 — Fix auth test type errors](backend/01-fix-auth-test-types.md)
- [02 — Fix bank test type errors](backend/02-fix-bank-test-types.md)
- [03 — Add the typecheck script](backend/03-add-typecheck-script.md)

## CI Checks
- `backend`: `docker-compose run --rm --no-deps ward_tests yarn typecheck` (CI job: `backend_typecheck`, new)
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)

## Notes
- No blanket `any` / `@ts-expect-error`. `as never` is acceptable only where the spec already uses it for an unused constructor dependency (bill-history).
- Exploration verified the full fix set in a scratch copy: `tsc` exited 0 and the 18 affected suites passed (519 tests).
- If `docker-compose run` fails with a `ward_mysql_test` container-name conflict, use `--no-deps` for typecheck/lint/unit runs.
- The issue's concern that `transaction.service.spec.ts` builds a stale personal `OwnerContext` turned out to be a typing artifact: at runtime `ORGANIZATION` is the organization variant, so the assertions are correct; the fix is the fixture's type annotation. The `in-memory-bank-repos.ts` error, by contrast, is genuinely stale fake-DB logic (see step 02).
