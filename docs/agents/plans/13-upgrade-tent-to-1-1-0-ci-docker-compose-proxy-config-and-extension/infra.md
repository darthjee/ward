# Infra Plan: Upgrade Tent to 1.1.0 (CI, docker-compose, proxy config and extension)

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produce:** every CI job and compose service that uses Tent pins `darthjee/tent:1.1.0` or
  `darthjee/tent-test:1.1.0`. Do the `docker-compose.yml` bump before `proxy` starts its
  verification.
- **Rely on:**
  - The Tent runtime stays at `/var/www/html/`.
  - `vendor/bin/*` still resolves from `/home/app/app` in `tent-test`.
  - The `tent` image still has `ssh`, `rsync` and a writable home.
  - If `proxy` finds that `vendor/` or the WORKDIR moved, update the `proxy_tests`,
    `proxy_lint` and `proxy_extension_tests` commands to match.
- **Exception:** `docs/agents/external/tent/*.md` (`:latest`) stay untouched.

## Steps

- [01 — Bump Tent images in CircleCI](infra/01-bump-circleci-images.md)
- [02 — Bump Tent images in docker-compose](infra/02-bump-docker-compose-images.md)
- [03 — Update infra agent docs and architecture/spec pages](infra/03-update-infra-docs.md)

## CI Checks

- `.circleci/config.yml`: `proxy_extension_tests` (local equivalent:
  `docker-compose run --rm proxy_tests`).
- Lint is local only: there is no `proxy_lint` CircleCI job. Run
  `docker-compose run --rm proxy_lint`.
- The deploy jobs (`upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`) run
  only on version tags, so they can't be exercised in the PR. Review them by reading.
- `make dev-up` must serve the frontend and proxy `*.json` to the backend through Tent 1.1.0.

## Notes

- Never run tooling on the host. Use `docker-compose run`.
- Deploy jobs call the repo's `bin/deploy_frontend.sh` by relative path. The image's
  `/usr/sbin/deploy_frontend.sh` stays unused (#15 handles the switch), so the two can't clash.
- Do not change upload logic, `EXCLUDE_FROM` or `generate_key_file` → `setup_ssh`. That is
  #15.
- Unrelated stale value: `.claude/agents/infra.md` lists `ward_navi` as `navi-hey:1.5.1`, but
  `docker-compose.yml` uses `1.6.1`. Fix it in the same table edit, since that table is being
  touched anyway.
