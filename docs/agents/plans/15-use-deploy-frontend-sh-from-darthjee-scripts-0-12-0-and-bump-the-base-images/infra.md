# Infra Plan: Use deploy_frontend.sh from darthjee/scripts 0.12.0 and bump the base images

Main plan: [plan.md](plan.md)

## Shared contracts

- `deploy_frontend.sh` must be on `PATH`: install it at `/usr/local/sbin/deploy_frontend.sh` in
  `vite_ward-base`; `darthjee/tent:1.1.0` already ships it at `/usr/sbin/`.
- All four base images at `0.2.0` in `version`, `Makefile` `BASE_VERSION` default and every CI pin.
- `proxy` provides `proxy/extension.exclude` (one line `tests/`); use it as
  `EXCLUDE_FROM=proxy/extension.exclude` in `upload_extension`.
- New CircleCI project variable `SSH_KNOWN_HOSTS`; `setup_ssh` fails fast when it is empty.

## Steps

- [01 — Bump the base images](infra/01-bump-base-images.md)
- [02 — Align CI image pins](infra/02-align-ci-pins.md)
- [03 — Add the setup_ssh command](infra/03-add-setup-ssh-command.md)
- [04 — Switch deploy jobs to the image script](infra/04-switch-deploy-jobs.md)

## CI Checks
- `.circleci`: `docker-compose run --rm circleci config validate` (CI: whole pipeline)
- `dockerfiles/base`: `make build-fe-base` / `bin/image.sh build vite_ward-base`, then
  `docker run --rm darthjee/vite_ward-base:0.2.0 which deploy_frontend.sh` (CI: `release-image` jobs on tags)

## Notes
- The path of `deploy_frontend.sh` inside `darthjee/scripts:0.12.0` is unverified; `yarn_builder.sh` lives at
  `/home/scripts/builder/yarn_builder.sh`, and the spec link suggests `/home/scripts/sbin/deploy_frontend.sh`.
  Confirm with `docker run --rm --entrypoint ls darthjee/scripts:0.12.0 -R /home/scripts` before writing the COPY.
- Test jobs pinned to `circleci_ward-base:0.2.0` only work once the tag build publishes it; the existing
  `requires: release-circleci_ward-base` gating handles tag builds, but branch builds will pull `0.2.0` and
  fail until it is published — check how the pipeline handled the previous bump and follow the same pattern.
- After merge, every SSH job fails until the maintainer sets `SSH_KNOWN_HOSTS` — intended.
- Kept `${SSH_REMOTE_DIR}_old_<epoch>` releases are not pruned by `cleanup`; manual pruning per `ssh/release.md`.
