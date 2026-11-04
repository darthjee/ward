# Infra Plan: Start the backend with bin/server.sh (compiled migrations) and fix the Render deploy job

Main plan: [plan.md](plan.md)

## Shared contracts

- Rely on `backend` producing `backend/bin/server.sh` (mode `100755`) and the `migration:run:prod` script.
  The existing builder `COPY ./backend/ /home/node/app/` and the final-stage copy carry it into
  `/home/node/app/bin/server.sh` with its exec bit. There is no `.dockerignore`.
- The image must expose `CMD ["bin/server.sh"]` with **no** `ENTRYPOINT`, so Render's Docker command
  `bin/server.sh` runs the script directly.

## Steps

- [01 — Production image runs bin/server.sh](infra/01-production-image-cmd.md)
- [02 — Harden scripts/deploy.sh](infra/02-harden-deploy-sh.md)
- [03 — Fail on Render API errors in scripts/render.sh](infra/03-render-sh-fail-with-body.md)
- [04 — Run build-and-release on ubuntu-2204](infra/04-circleci-machine-image.md)

## CI Checks
- No CI job tests `scripts/` or builds `dockerfiles/production_ward/Dockerfile`. Validate manually:
  - `bash -n scripts/deploy.sh scripts/render.sh` (inside a container, e.g. `docker run --rm -v "$PWD":/w -w /w bash:5 bash -n scripts/deploy.sh scripts/render.sh`).
  - `docker build -f dockerfiles/production_ward/Dockerfile .` to confirm the image builds and
    `docker inspect` shows `Cmd: ["bin/server.sh"]` and an empty `Entrypoint`.
- `.circleci/config.yml` must stay valid YAML. Use `circleci config validate` if available via docker.

## Notes
- `checkLastVersion` calls `exit 0`, which inside a function ends the whole script. That is the desired
  "exit 0 without touching Render" behaviour for `update_deploy_branch`. The second CI step (`deploy` →
  `run_deploy`) already checks the version itself.
- `service_id` is also called by `force_deploy` and `watch_last_deployment`. Apply the empty-id guard through
  one helper so every caller gets it.
- Unrelated pre-existing nit: `last_deployment` in `render.sh` reads the global `$SERVICE_ID` instead of `$1`.
  You may fix it while editing (`SERVICE_ID=$1`), but it is optional.
- Docs (`render.md`, `architecture/infra.md`) are updated by the architect, not here.
