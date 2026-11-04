# Fail on Render API errors in scripts/render.sh
Add `--fail-with-body` to `request()` (L9–12) and to the PATCH in `update_service_branch` (L59–64). An HTTP
error (bad API key, 404 service) then makes curl exit non-zero while still printing the response body for
diagnosis. This needs curl ≥ 7.76, which step 04 provides.

Check that `service_id` (L32–36, a `request | jq | sed` pipeline) surfaces the curl failure rather than
masking it behind the pipeline's last command. Either capture the `request` output first and check its
status, or rely on `set -o pipefail` if the scripts use bash.

## Files to Change
- `scripts/render.sh`: add `curl --fail-with-body` in `request()` and `update_service_branch`, and propagate
  the failure out of `service_id`.
