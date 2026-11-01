# Infra Plan: Fix backend_integration CI: convert Jest configs to .mjs

Main plan: [plan.md](plan.md)

## Shared contracts

- CircleCI keeps running `npm run test:integration` in `backend`; the backend agent changes only the
  script body. No job, image, or step change is needed.
- The integration Jest config deliberately has no `globalSetup`; MySQL readiness is a bounded retry
  (~60 s) inside `createTestDataSource()` (`backend/src/database/tests/integration/test-data-source.ts`).

## Implementation Steps

### Step 1 — Fix the outdated comment above `backend_integration`
In `.circleci/config.yml` (comment just above the `backend_integration:` job definition, around
lines 165-166), replace "No wait step: the suite's Jest globalSetup retries the connection until MySQL
is ready." with wording such as "No wait step: `createTestDataSource()` retries the connection until
MySQL is ready (the integration Jest config deliberately has no globalSetup)." Change nothing else in
the job.

## Files to Change
- `.circleci/config.yml` — correct the comment above the `backend_integration` job

## Notes
- Do not change the CI image or add `NODE_OPTIONS`; the issue rejected both alternatives.
- Dockerfiles, `docker-compose.yml`, `Makefile`, `bin/` and `scripts/` do not reference the Jest configs.
