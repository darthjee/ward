# Proxy Plan: Upgrade Tent to 1.1.0 (CI, docker-compose, proxy config and extension)

Main plan: [plan.md](plan.md)

## Shared contracts

- **Rely on:** `infra` has already moved `ward_proxy`, `proxy_tests` and `proxy_lint` in
  `docker-compose.yml` (and `proxy_extension_tests` in CI) to `1.1.0`.
- **Produce:**
  - Proof that `proxy_tests` and `proxy_lint` pass on `tent-test:1.1.0`.
  - If the image moved `vendor/` or the WORKDIR, report the new path so `infra` can fix the
    compose and CI commands.
- **Pins:** only `darthjee/tent:1.1.0` and `darthjee/tent-test:1.1.0` in the proxy tooling and
  docs. `docs/agents/external/tent/*.md` (`:latest`) stay untouched.

## Steps

- [01 — Update proxy tooling and agent doc pins](proxy/01-update-tooling-pins.md)
- [02 — Verify extension tests and lint on tent-test 1.1.0](proxy/02-verify-tests-and-lint.md)
- [03 — Recheck header forwarding and refresh proxy docs](proxy/03-recheck-headers-and-docs.md)

## CI Checks

- `proxy/extension`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`).
- `proxy/`: `docker-compose run --rm proxy_lint` (local only, no CI job).
- All of the above plus `php -l`: `.claude/scripts/check_proxy.sh`.

## Notes

- No changes are expected in `proxy/dev_configuration/`, `proxy/prod_configuration/` or
  `proxy/extension/lib/`.
- `proxy/prod_configuration/` has unused `use` imports of `Tent\Handlers\*` and
  `Tent\Models\*`. These are harmless even if a class went away. Do not clean them up in this
  issue.
- Do not adopt new Tent 1.1.0 features, and do not touch `proxy/extension.exclude` (#15).
