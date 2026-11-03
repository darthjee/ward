# Plan: Upgrade Tent to 1.1.0 (CI, docker-compose, proxy config and extension)

Issue: [13-upgrade-tent-to-1-1-0-ci-docker-compose-proxy-config-and-extension.md](../../issues/13-upgrade-tent-to-1-1-0-ci-docker-compose-proxy-config-and-extension.md)

## Overview

Move every pinned `darthjee/tent` / `darthjee/tent-test` reference to `1.1.0` so production, CI,
local dev and agent tooling all run the same multi-arch Tent. `infra` bumps the CI jobs and the
compose services first, then `proxy` checks that the extension tests and lint pass on
`tent-test:1.1.0` and fixes them if needed. Each agent also refreshes the agent docs and
`docs/agents/` pages in its area. No proxy rule or extension behaviour change is expected. The
upgrade has no breaking API changes (see the issue's "Tent 0.10.4 → 1.1.0 changes").

## Agents involved

- [infra](infra.md)
- [proxy](proxy.md)

## Shared contracts

- **Image tags:** `darthjee/tent:1.1.0` and `darthjee/tent-test:1.1.0` exactly. No other
  version of either image may stay pinned anywhere in the repo, including `.claude/` and
  `docs/agents/`. This is checked with
  `grep -rnE "darthjee/tent(-test)?:[0-9]" . --exclude-dir=node_modules --exclude-dir=.git`,
  which must return only `1.1.0` hits (the issue file is the exception).
- **Agreed exception:** `docs/agents/external/tent/*.md` use `darthjee/tent:latest`. These are
  vendored, generic Tent usage docs, not pins, and they stay unchanged.
- **Ordering:** `infra` bumps `docker-compose.yml` (`ward_proxy`, `proxy_tests`, `proxy_lint`)
  before `proxy` runs its verification. `proxy` relies on those three services running
  `1.1.0`.
- **Image-path assumptions both sides rely on** (unchanged unless verification proves
  otherwise):
  - The Tent runtime lives at `/var/www/html/`. `/var/www/html/loader.php` loads
    `/var/www/html/extension/loader.php`.
  - In `tent-test`, `vendor/bin/phpunit` and `vendor/bin/phpcs` resolve relative to the image
    WORKDIR / `/home/app/app`.
  - The `tent` image still ships `ssh` and `rsync`, and has a writable `~`.
- **Handoff:** if `tent-test:1.1.0` moves `vendor/` or the WORKDIR, the command fix in
  `docker-compose.yml` and in the `proxy_extension_tests` CI job belongs to `infra`. `proxy`
  reports the new path, and the decision is recorded in `docs/agents/specs/deploy/ssh/proxy.md`.
