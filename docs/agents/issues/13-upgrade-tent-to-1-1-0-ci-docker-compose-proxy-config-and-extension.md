# Issue: Upgrade Tent to 1.1.0 (CI, docker-compose, proxy config and extension)

## Description

Part of Epic #10 (deploy Ward). Upgrade the Tent proxy from `0.10.4` to `1.1.0` everywhere. Tent 1.1.0 ships `deploy_frontend.sh` from `darthjee/scripts:0.12.0`, which the deploy jobs need, and it publishes `darthjee/tent:1.1.0` and `darthjee/tent-test:1.1.0` as single multi-arch tags (amd64 + arm64).

Build against `docs/agents/specs/deploy/ssh/proxy.md`. If a decision changes, update that spec in the same PR.

### Depends on

#12 (deployment specs), already merged.

### Prerequisite

Met: `darthjee/tent:1.1.0` and `darthjee/tent-test:1.1.0` are both published on Docker Hub as multi-arch tags (darthjee/tent#298).

## Problem

Ward pins Tent `0.10.4` in CI and `docker-compose.yml`, and older `0.10.0`/`0.10.1` tags in `.claude/` tooling and agent docs. The deploy work in Epic #10 needs Tent `1.1.0`: it ships `deploy_frontend.sh` (`darthjee/scripts:0.12.0`) and is multi-arch. The mixed pins also mean local dev, the agent tooling and CI don't all run the same Tent as production.

## Expected Behavior

- No `darthjee/tent` or `darthjee/tent-test` reference other than `1.1.0` is left in the repo (including `.claude/`).
- `proxy_extension_tests` passes on `tent-test:1.1.0` (CI and the `proxy_tests` compose service), and `proxy_lint` passes.
- `make dev-up` serves the frontend and proxies the API through Tent 1.1.0.
- `docs/agents/specs/deploy/ssh/proxy.md` matches the result.

## Solution

### Changes

- **CI** (`.circleci/config.yml`): `darthjee/tent:0.10.4` → `1.1.0` in `upload_proxy_files`, `copy_proxy_configuration` and `upload_extension`. `darthjee/tent-test:0.10.4` → `1.1.0` in `proxy_extension_tests`.
- **Dev stack** (`docker-compose.yml`): `ward_proxy` (`darthjee/tent`), `proxy_tests` and `proxy_lint` (`darthjee/tent-test`) → `1.1.0`, so local dev and CI run the same Tent as production.
- **Proxy code:** no changes are expected in `proxy/prod_configuration/`, `proxy/dev_configuration/` or `proxy/extension/` (see "Tent 0.10.4 → 1.1.0 changes" below). If `proxy_extension_tests` or `proxy_lint` fail on the new `tent-test` image (for example, tooling versions changed with its new `dev_tent-base:0.1.0` base), fix them in the same PR.
- **Stale agent tooling and docs:** `.claude/scripts/check_proxy.sh` (`tent:0.10.1`), `.claude/agents/proxy.md` (`tent:0.10.1`, `tent-test:0.10.0`) and `.claude/agents/infra.md` (`tent:0.10.1`, `tent-test:0.10.4`) → `1.1.0`.

### Scope

**In scope**

- Every Tent pin in the repo moves to `1.1.0`, not only the `0.10.4` ones: CI jobs, `docker-compose.yml` services, `.claude/scripts/check_proxy.sh` and the agent docs.
- Adapting to Tent 0.10.4 → 1.1.0 changes **only as far as needed to keep today's behaviour working** (configuration, rules or extension API changes that would otherwise break).

**Out of scope**

- Adopting new Tent 1.1.0 features (new rule types, cache options, …). Open separate issues if wanted.
- Upload job logic, `EXCLUDE_FROM` and `proxy/extension.exclude` (#15). This issue only changes the image tag those jobs run on.
- Calling `deploy_frontend.sh` (#14/#15). It ships in the image, but nothing in this issue uses it.

### Tent 0.10.4 → 1.1.0 changes

Reviewed from the release notes (1.0.0–1.1.0) and the `0.10.4...1.1.0` diff.

**Breaking changes: none.** The configuration API (`Configuration::buildRule`, handler and matcher types) and extension loading are unchanged. `loader.php` only gains new `require_once` lines. PHP stays on 8.4. The 1.0.0 major bump marks a milestone, not an API break.

Behaviour changes that touch Ward:

| Version | Change | Effect on Ward |
|---|---|---|
| 1.0.1 | `StaticFileHandler` sends `ETag`/`Last-Modified` and answers conditional GETs with `304` | Static rules get browser revalidation for free. Manually check that the frontend still loads normally. |
| 1.0.3 | Multiple `Set-Cookie` headers are no longer collapsed into the last one | A fix: every cookie the backend sets now reaches the client. |
| 1.0.0 | `gd`/`exif` installed; `upload_max_filesize=20M`, `post_max_size=25M` (`tent.ini`) | No effect: nothing in Ward relies on the old PHP defaults. |
| 1.1.0 | Multi-arch images; `deploy_frontend.sh` (`darthjee/scripts:0.12.0`) in `/usr/sbin/`; `tent-test` built on `dev_tent-base:0.1.0` | The reason for the upgrade. |

Reference: https://github.com/darthjee/tent/compare/0.10.4...1.1.0

### Backward compatibility

- **Deploy jobs unchanged:** `upload_proxy_files`, `copy_proxy_configuration` and `upload_extension` call the repo's `bin/deploy_frontend.sh` by explicit path, so on `tent:1.1.0` they keep using it. The image's `/usr/sbin/deploy_frontend.sh` stays unused until #15 switches over, and the two can't clash. **#13 ships independently of #15.**
- **Host-only files:** `copy_proxy_configuration` still carries `configuration/locals.php` and `.htaccess` from the live release. The configuration API is unchanged, so the existing `locals.php` keeps working.
- **Live host:** the first tag release after merge puts Tent 1.1.0 on the host (`upload_proxy_files` uploads the image's `/var/www/html/`).
  - The cache format is unchanged, so existing `cache/` entries stay valid and there's no need to purge them.
  - Static file ETags derive from size and mtime, so they change on every release: one revalidation miss per asset after a deploy, which is harmless.
  - On the SSH host Tent runs on the **host's PHP**, not the image's. The 1.1.0 diff needs nothing newer than what 0.10.4 already runs on there, but the first-release manual check must confirm the site responds.
- **Rollback:** this is only a tag change, so reverting the PR and tagging again redeploys 0.10.4.

## Benefits

- One Tent version (`1.1.0`) everywhere: production, CI, local dev and agent tooling.
- Unblocks #15, which switches the deploy jobs to the image's `deploy_frontend.sh`.
- Multi-arch images run natively on arm64 dev machines.
- Picks up the static-file `304` support and the multiple `Set-Cookie` fix.
