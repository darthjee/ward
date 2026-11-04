# Harden scripts/deploy.sh
Make the deploy job safe on non-tag runs and loud on failures.

- `update_deploy_branch` (L74–77): call `checkLastVersion` first, before `service_id` /
  `update_service_branch`. When HEAD is not the tag, the first `build-and-release` step then exits 0 without
  touching the Render service.
- `check_deployment_status` (L24–40): add `pre_deploy_failed` to the failure statuses, alongside `build_failed`,
  `update_failed`, `canceled` and `deactivated`. Print the status and exit 1.
- Empty service id: add a helper (e.g. `required_service_id`) that calls `service_id`. If the result is empty,
  it prints `No Render service named "$RENDER_SERVICE_NAME" found` to stderr and exits 1. Use it in
  `update_deploy_branch`, `force_deploy` (L64) and `watch_last_deployment` (L81) instead of the bare
  `SERVICE_ID=$(service_id)`. Because `exit` inside `$(...)` only ends the subshell, do the check in the
  caller's shell: assign first, then test `[ -z "$SERVICE_ID" ]`. Alternatively, have the helper set the
  global `SERVICE_ID` directly instead of using command substitution.
- With `--fail-with-body` (step 03), a failed `request` inside `$(...)` does not abort the caller on its own.
  Make sure callers propagate it, either with `set -e` at the top of `deploy.sh` (check it does not break the
  `isLatestCommit` grep) or with explicit `|| exit 1` on the API-calling assignments.

## Files to Change
- `scripts/deploy.sh`: version check in `update_deploy_branch`, `pre_deploy_failed` failure, empty-service-id
  guard, and API-error propagation.
