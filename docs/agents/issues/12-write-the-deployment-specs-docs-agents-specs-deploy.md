# Write the deployment specs (docs/agents/specs/deploy/)

## Context

Part of Epic #10 (deploy Ward). Write the **deployment feature specs** under `docs/agents/specs/deploy/`, following the feature-spec lifecycle in `docs/agents/specs.md`. The later sub-issues build against these specs. They are the source of truth for every deployment decision while the Epic is in progress.

The specs record the decisions already agreed in #10. No pipeline, script or code changes happen in this issue.

## What needs to be done

Docs only: create the deployment feature specs under `docs/agents/specs/deploy/` and register
them in `docs/agents/specs.md`.

### Files

Layout grouped by deploy target. Shared SSH staging gets its own file, and every variable lives in one `environment.md`.

```
specs/deploy/
  README.md
  pipeline.md
  images.md
  render.md
  ssh/
    staging.md
    proxy.md
    frontend.md
    release.md
  security.md
  environment.md
  provisioning.md
```

- `README.md`
  - Overview, purpose and scope (in and out), and the decisions behind the deployment:
    - the backend is built by Render, with no published backend image;
    - no standalone image;
    - the deploy script comes from the images;
    - Navi warm-up is out of scope;
    - DB TLS is tracked in #11.
  - An index of every file.
  - The sub-issue map:

    | Sub-issue | Files |
    |---|---|
    | #13 | `ssh/proxy.md` (Tent pins), `pipeline.md` |
    | #14 | `render.md` |
    | #15 | `images.md`, `ssh/staging.md`, `ssh/proxy.md` (`EXCLUDE_FROM`), `ssh/frontend.md`, `ssh/release.md`, `security.md` (guard), `environment.md` (`SSH_KNOWN_HOSTS`) |
    | #16 | all files, folded into the permanent docs |
    | manual | `provisioning.md`, `environment.md` |

- `pipeline.md`
  - Deploy jobs run only on semver tags (`/\d+\.\d+\.\d+/`, branches ignored).
  - Every deploy job requires the test and lint jobs.
  - The job graph: base-image matrix → `build-and-release` (Render) and the SSH uploads → `release`.
  - The image each job runs in.
- `images.md`
  - The base-image matrix (`ward-base`, `circleci_ward-base`, `production_ward-base`, `vite_ward-base` × amd64/arm64, `bin/image.sh`) and its guards (`skip_if_not_tag`, `skip_if_unchanged`, `FORCE_IMAGE_BUILD`).
  - Version rules: the `version` file and the CI pins move together, and a change to the shared Dockerfile means bumping every version.
  - `deploy_frontend.sh` comes from `darthjee/scripts:0.12.0` through the images: `vite_ward-base` copies it into `/usr/local/sbin/`, and `darthjee/tent:1.1.0` ships it in `/usr/sbin/`. There is no repo copy.
  - No published backend image and no standalone image.
- `render.md`
  - Render builds `dockerfiles/production_ward/Dockerfile` from the tag branch.
  - `backend/bin/server.sh` runs `migration:run:prod` (`typeorm migration:run -d dist/database/data-source.js`), then `exec node dist/main.js`, and fails fast. The image uses `CMD ["bin/server.sh"]` with no `ENTRYPOINT`, and the Render Docker command is `bin/server.sh`.
  - `scripts/deploy.sh` runs `checkLastVersion` before `update_deploy_branch`, polls the deploy until `live`, and treats `build_failed`, `update_failed`, `pre_deploy_failed`, `canceled` and `deactivated` as failures.
- `ssh/staging.md`
  - The staging directory `${SSH_REMOTE_TEMP_DIR}-${CIRCLE_WORKFLOW_WORKSPACE_ID}`, shared by every SSH job in a workflow.
  - The `deploy_frontend.sh` actions Ward uses and their per-call variables (`SOURCE`, `DEPLOY_PATH`, `TARGET`, `EXCLUDE_FROM`, `KEEP_OLD`, `CLEANUP_MAX_AGE_MINUTES`).
  - Each SSH job starts with `generate_key_file`, preceded by the `SSH_KNOWN_HOSTS` guard.
- `ssh/proxy.md`
  - Tent 1.1.0 (`tent`/`tent-test`, multi-arch), pinned everywhere (CI and `docker-compose.yml`).
  - The three upload jobs (`upload_proxy_files`, `upload_extension`, `copy_proxy_configuration`).
  - `locals.php` and `.htaccess` exist only on the host and are carried over by `copy_files`.
  - `upload_extension` excludes `tests/` with `EXCLUDE_FROM`.
- `ssh/frontend.md`: `deploy_frontend.sh build` produces `dist/`, which is uploaded to `<staging>/static/`. There is no `generate_folder` step (`upload` creates the remote folder).
- `ssh/release.md`
  - The swap runs only after every upload job and `build-and-release` (backend live) succeed.
  - `KEEP_OLD=true`, so the previous release stays as `${SSH_REMOTE_DIR}_old_<epoch>`, with pruning guidance.
  - `cleanup` runs after the swap.
  - Rollback: `mv` the kept release back, or re-run the workflow of the previous tag.
- `security.md`
  - Host-key pinning with `SSH_KNOWN_HOSTS`, plus the CI guard.
  - Where each secret lives: Render, `locals.php` on the host, CI deploy credentials only.
  - Use a deploy-only SSH key, and keep staging and kept releases outside the web root.
  - The proxy cache holds public responses only.
  - CI never calls `render.sh get_env_vars`.
  - TLS to MySQL is missing and tracked in #11.
- `environment.md`: every variable and host-only file the deployment needs, grouped by where it lives (CircleCI project, Render service, SSH host files: `locals.php`, `.htaccess`), with its purpose and the job or script that reads it. #16 folds this file into `docs/agents/environment-variables.md`.
- `provisioning.md`
  - The manual checklist for the Render service: Docker runtime, Git-backed, auto-deploy off, Docker command `bin/server.sh`, environment variables from `environment.md`. The database already exists.
  - The SSH host: parent directories, `locals.php`, `.htaccess`, and `ssh-keyscan` for `SSH_KNOWN_HOSTS`.
  - Setting the CircleCI variables, the first tag, and the acceptance criteria of #10.

### Decisions to record

These were open after #10. The specs pin them so #13–#15 don't each decide on their own:

| Decision | Value | Spec file | Sub-issue |
|---|---|---|---|
| Base image versions | All four images (`ward-base`, `circleci_ward-base`, `production_ward-base`, `vite_ward-base`) go from `0.1.0` to `0.2.0`, for amd64 and arm64. The `version` file and every CI pin move together. | `images.md` | #15 |
| Extension exclude file | `proxy/extension.exclude`, containing `tests/`. It sits outside the uploaded tree, so it is never uploaded itself. `upload_extension` runs with `EXCLUDE_FROM=proxy/extension.exclude` (rsync `--exclude-from`, patterns relative to `proxy/extension/`). | `ssh/proxy.md` | #15 |
| Known-hosts guard | One reusable CircleCI `command`, `setup_ssh`, that fails when `SSH_KNOWN_HOSTS` is empty and then runs `deploy_frontend.sh generate_key_file`. Every SSH job (`upload_proxy_files`, `upload_extension`, `copy_proxy_configuration`, `upload_fe_files`, `release`) calls `setup_ssh` instead of `generate_key_file`, so the guard and the key setup can never be separated. | `ssh/staging.md`, `security.md` | #15 |
| Cleanup age | `deploy_frontend.sh cleanup` runs with the script's default `CLEANUP_MAX_AGE_MINUTES` (1440, i.e. 24h). The longest wait in a workflow (the Render watch) is about 8 minutes, so a running workflow's staging directory is never removed. | `ssh/release.md` | #15 |
| `build-and-release` executor and Render hardening | `machine: image: ubuntu-2204:current`, matching Kerghan, which provides curl ≥ 7.76 and `jq`. `scripts/render.sh` uses `curl --fail-with-body`, so Render API errors fail the job. `scripts/deploy.sh` exits 1 when `service_id` finds no service named `$RENDER_SERVICE_NAME`, instead of sending `PATCH /v1/services/` with an empty id. | `render.md` | #14 |

### Required tests (content of each spec's section)

The deployment is verified manually by the maintainer (decided in #10). So each spec file's **Required tests** section lists two kinds of checks:

- **Automated checks that must stay green**, where they exist:
  - backend tests and lint (`render.md`: `migration:run:prod` and `bin/server.sh` must not break the backend suite);
  - `proxy_extension_tests` on `tent-test:1.1.0` (`ssh/proxy.md`);
  - frontend tests and lint (`ssh/frontend.md`).
- **Manual verification steps** for the first tag release, each tied to the rules in that file. Together they form the acceptance criteria of #10. For example:
  - Render reports `live` (`render.md`);
  - an empty `SSH_KNOWN_HOSTS` fails the SSH jobs (`ssh/staging.md`);
  - the live dir holds the preserved `locals.php` and `.htaccess` and no `extension/tests/` (`ssh/proxy.md`);
  - a kept `_old_<epoch>` release exists and old staging dirs are gone (`ssh/release.md`);
  - non-tag builds run no deploy jobs (`pipeline.md`).

No new automated test suite (such as Kerghan's `scripts_tests`) is required.

### Reference sources

The specs' **Reference** sections link only to these GitHub URLs, never to local paths. All were checked to exist on `main`. Each file cites the ones relevant to it.

| Source | URL | Relevant to |
|---|---|---|
| `deploy_frontend.sh` 0.12.0 (`darthjee/scripts` image, built from the `darthjee/docker` repo) | https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh | `ssh/*`, `images.md`, `security.md` |
| `darthjee/scripts` 0.12.0 image (README, Dockerfile) | https://github.com/darthjee/docker/tree/main/scripts/0.12.0 | `images.md`, `ssh/staging.md` |
| Tent image shipping the script | https://github.com/darthjee/tent/blob/main/dockerfiles/tent/Dockerfile, https://github.com/darthjee/tent/issues/298 | `images.md`, `ssh/proxy.md` |
| Kerghan pipeline (closest precedent: Render + SSH + base-image matrix) | https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml | `pipeline.md`, `ssh/*` |
| Kerghan base-image release | https://github.com/darthjee/kerghan/blob/main/bin/image.sh | `images.md` |
| Kerghan Render deploy | https://github.com/darthjee/kerghan/blob/main/scripts/deploy.sh, https://github.com/darthjee/kerghan/blob/main/scripts/render.sh | `render.md` |
| Oak server start (migrate, then serve) | https://github.com/darthjee/oak/blob/main/source/bin/server.sh | `render.md` |
| Oak pipeline and deploy script (original SSH pattern) | https://github.com/darthjee/oak/blob/main/.circleci/config.yml, https://github.com/darthjee/oak/blob/main/bin/deploy_frontend.sh | `pipeline.md`, `ssh/*` |
| Epic and related issues | https://github.com/darthjee/ward/issues/10, https://github.com/darthjee/ward/issues/11 | `README.md`, `security.md` |

Every file ends with a **Reference** section (GitHub web URLs only, from *Reference sources* above) and a **Required tests** section, as `docs/agents/specs.md` requires. The specs describe decisions, not code.

Also add an entry for `specs/deploy/` under *Active specs* in `docs/agents/specs.md`.

## Acceptance criteria

- [ ] `docs/agents/specs/deploy/` exists with the files above, each following the conventions in `docs/agents/specs.md`.
- [ ] `docs/agents/specs.md` lists the deployment specs under *Active specs*, linking Epic #10.
- [ ] No other files change.
