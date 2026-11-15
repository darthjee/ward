# Infra Plan: TS18036 — `AccountService` fails to build: class decorator combined with `static #private`

Main plan: [plan.md](plan.md)

## Shared contracts

- The backend exposes `yarn build` / `npm run build` (`nest build`) in `backend/package.json`. After the backend change, it exits 0.
- The new job instance must be named exactly `backend_build`.

## Implementation Steps

### Step 1 — Add the per-push `backend_build` job
In `.circleci/config.yml`, add a new `yarn_project` instance to the `test` workflow, after `backend_checks` (lines 25-32):

```yaml
      - yarn_project:
          name: backend_build
          dir: backend
          image: darthjee/circleci_ward-base:0.1.0
          script: build
          step_name: Build
          requires: [release-circleci_ward-base, release-circleci_ward-base-arm64]
          filters: *all_tags
```

- `yarn_project` (lines 150-179) already calls `setup_project`, which copies `backend/*` to the root and runs `yarn install`, then runs `npm run << parameters.script >>`. No job-definition change is needed.
- Keep the image pinned at `0.1.0`, consistent with the pin note at lines 9-10.

### Step 2 — Gate the release and upload jobs on `backend_build`
Add `backend_build` to the `requires` of:
- `build-and-release` (lines 55-63)
- `upload_proxy_files` (inline list at line 70)
- `upload_fe_files` (lines 73-81)

Do not add it to `coverage-final`, which is coverage-specific. `release`, `upload_extension` and `copy_proxy_configuration` already depend on these jobs transitively.

## Files to Change
- `.circleci/config.yml` — add the `backend_build` job to the `test` workflow, and add it to the `requires` of `build-and-release`, `upload_proxy_files` and `upload_fe_files`.

## CI Checks
- `.circleci`:
  - `docker-compose run --rm circleci config validate`
  - `docker-compose run --rm circleci config process .circleci/config.yml`

## Notes
- Use `yarn build` (the same command the Docker image runs), not a separate `tsc --noEmit`. Type-checking test files is out of scope (#115).
- The job only passes once the backend fix is in the same branch.
- Do not move the `circleci_ward-base` pin to 0.2.0 here.
- No frontend build job (out of scope).
