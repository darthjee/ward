# Deployment specs

Feature specs for **deploying Ward** — Epic [#10](https://github.com/darthjee/ward/issues/10).
While this folder exists it is the source of truth for every deployment decision; the
sub-issues of #10 read it instead of deciding on their own. See [specs.md](../../specs.md) for
the spec lifecycle.

## Overview

Ward ships on two targets, released together from one semver tag:

- **Render** (free tier, 512 MB) runs the NestJS backend. Render builds the backend image
  itself from the tag; CI only moves the deploy branch and watches the deploy until it is live.
- **An SSH host** serves everything else through the Tent proxy: the proxy configuration, the
  custom extension, and the built frontend (`static/`). CI uploads each piece into a
  workflow-scoped staging directory, then swaps the staged release into place in one step.

## Purpose

Pin the deployment design agreed in #10 — pipeline shape, images, Render deploy, SSH upload and
release, security and environment — so that #13, #14 and #15 implement it consistently and #16
can fold it into the permanent docs.

## Scope

In scope:

- the CircleCI deploy pipeline on semver tags ([pipeline.md](pipeline.md));
- the base-image matrix and its versioning ([images.md](images.md));
- the Render backend deploy ([render.md](render.md));
- the SSH staging, uploads and release swap ([ssh/](#index));
- deployment security, environment and the one-time manual provisioning.

Out of scope:

- **Navi cache warm-up** after a release (most of Ward's data is user-scoped; see
  `cache-warmer.md`). No warm-up job is part of this pipeline.
- **TLS between the backend and MySQL** — tracked in
  [#11](https://github.com/darthjee/ward/issues/11).
- Any application feature work.

## Decisions

- **The backend is built by Render.** There is no published backend image: Render builds
  `dockerfiles/production_ward/Dockerfile` from the tag branch.
- **No standalone image.** Ward does not publish an all-in-one image; the SSH host runs Tent and
  receives files, not images.
- **The deploy script comes from the images.** `deploy_frontend.sh` is provided by
  `darthjee/scripts:0.12.0` through Ward's `vite_ward-base` image and by `darthjee/tent:1.1.0`.
  Ward keeps no copy in the repository.
- **Navi warm-up is out of scope** (see above).
- **DB TLS is tracked in #11**, not here.
- The decisions left open after #10 (base-image versions, extension exclude file, known-hosts
  guard, cleanup age, `build-and-release` executor and Render hardening) are pinned in the files
  listed in the table below.

| Decision | Spec file |
|---|---|
| Base images `0.1.0` → `0.2.0`, amd64 + arm64, `version` file and CI pins together | [images.md](images.md) |
| `proxy/extension.exclude` (`tests/`) passed as `EXCLUDE_FROM` | [ssh/proxy.md](ssh/proxy.md) |
| `setup_ssh` command: `SSH_KNOWN_HOSTS` guard + `generate_key_file` | [ssh/staging.md](ssh/staging.md), [security.md](security.md) |
| `cleanup` with the default `CLEANUP_MAX_AGE_MINUTES` (1440) | [ssh/release.md](ssh/release.md) |
| `build-and-release` on `ubuntu-2204:current`, `curl --fail-with-body`, empty service-id guard | [render.md](render.md) |

## Index

| File | Concern |
|---|---|
| [pipeline.md](pipeline.md) | Tag filters, job requirements, job graph, job images |
| [images.md](images.md) | Base-image matrix, guards, version rules, where `deploy_frontend.sh` comes from |
| [render.md](render.md) | Render build, `bin/server.sh`, `scripts/deploy.sh` flow and failure states |
| [ssh/staging.md](ssh/staging.md) | Workflow staging directory, `deploy_frontend.sh` actions and variables, `setup_ssh` |
| [ssh/proxy.md](ssh/proxy.md) | Tent 1.1.0 pins, proxy upload jobs, host-only files, extension exclude |
| [ssh/frontend.md](ssh/frontend.md) | Frontend build and upload to `static/` |
| [ssh/release.md](ssh/release.md) | Release swap, kept releases, cleanup, rollback |
| [security.md](security.md) | Host-key pinning, secret locations, SSH key, cache, known gaps |
| [environment.md](environment.md) | Every variable and host-only file, by where it lives |
| [provisioning.md](provisioning.md) | One-time manual setup of Render, the SSH host and CircleCI |

## Sub-issue map

| Sub-issue | Files |
|---|---|
| [#13](https://github.com/darthjee/ward/issues/13) | `ssh/proxy.md` (Tent pins), `pipeline.md` |
| [#14](https://github.com/darthjee/ward/issues/14) | `render.md` |
| [#15](https://github.com/darthjee/ward/issues/15) | `images.md`, `ssh/staging.md`, `ssh/proxy.md` (`EXCLUDE_FROM`), `ssh/frontend.md`, `ssh/release.md`, `security.md` (guard), `environment.md` (`SSH_KNOWN_HOSTS`) |
| [#16](https://github.com/darthjee/ward/issues/16) | all files, folded into the permanent docs |
| manual | `provisioning.md`, `environment.md` |

## Reference

- Epic: https://github.com/darthjee/ward/issues/10
- DB TLS follow-up: https://github.com/darthjee/ward/issues/11
- Closest precedent (Render + SSH + base-image matrix): https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml

## Required tests

This file holds no rules of its own. The deployment is verified manually by the maintainer on
the first tag release: the **Required tests** sections of every file in the [index](#index)
together form the acceptance criteria of #10.
