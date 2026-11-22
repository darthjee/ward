# Infra Plan: Fix backend test-file type errors and typecheck tests in CI

Main plan: [plan.md](plan.md)

## Shared contracts

- Relies on backend's `"typecheck": "tsc --noEmit -p tsconfig.json"` script in `backend/package.json` (run by `yarn_project` as `npm run typecheck`).
- Produces the workflow entry `backend_typecheck`, required by `build-and-release`, `upload_proxy_files` and `upload_fe_files`.

## Implementation Steps

### Step 1 — Add the `backend_typecheck` workflow entry
In `.circleci/config.yml`, right after the `backend_build` entry (lines ~33–40), add an identical `yarn_project` entry with a new name, script and step name:

```yaml
      - yarn_project:
          name: backend_typecheck
          dir: backend
          image: darthjee/circleci_ward-base:0.1.0
          script: typecheck
          step_name: Typecheck
          requires: [release-circleci_ward-base, release-circleci_ward-base-arm64]
          filters: *all_tags
```

### Step 2 — Gate the release chain on it
Add `backend_typecheck` next to `backend_build` in the `requires` of:
- `build-and-release` (multi-line list, `- backend_build` at line ~67)
- `upload_proxy_files` (inline list at line ~79)
- `upload_fe_files` (multi-line list, `- backend_build` at line ~86)

No other job requires `backend_build`; `coverage-final` and `release` are left unchanged.

## Files to Change
- `.circleci/config.yml` — new `backend_typecheck` entry, added to three `requires` lists

## CI Checks
- `.circleci`: validate YAML syntax (e.g. `circleci config validate` if available via a container; otherwise review carefully). The job runs on every push.

## Notes
- Must land in the same PR as, or after, the backend fixes; otherwise the new job fails.
- CI docs updates (`docs/agents/architecture/infra.md`, `deployment.md`, `contributing.md`) are architect-owned and listed in [plan.md](plan.md).
