# Proxy Plan: Use deploy_frontend.sh from darthjee/scripts 0.12.0 and bump the base images

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce `proxy/extension.exclude` with exactly one line: `tests/`. `infra` passes it to
  `deploy_frontend.sh upload` as `EXCLUDE_FROM=proxy/extension.exclude` in `upload_extension`, with
  `SOURCE=proxy/extension/`, so patterns are relative to `proxy/extension/`.

## Implementation Steps

### Step 1 — Add the extension exclude file
Create `proxy/extension.exclude` containing the single line `tests/` (trailing newline). It lives next to,
not inside, `proxy/extension/`, so it is never uploaded itself. This replaces the CI step that ran
`rm -rf proxy/extension/tests/` on the checkout. Make sure no proxy lint/test config picks the file up as
source (it is plain text, not PHP).

## Files to Change
- `proxy/extension.exclude` — new; one line `tests/`.

## CI Checks
- `proxy`: `docker-compose run --rm proxy_tests` and `docker-compose run --rm proxy_lint` (should be unaffected).

## Notes
- The exclude semantics come from `deploy_frontend.sh` 0.12.0 (`EXCLUDE_FROM`, rsync/tar-style patterns);
  see `docs/agents/specs/deploy/ssh/proxy.md` L34.
