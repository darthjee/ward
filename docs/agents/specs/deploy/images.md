# Images

The base-image matrix and where the deploy script comes from. Owned by
[#15](https://github.com/darthjee/ward/issues/15).

## Base-image matrix

- Four images, all targets of the shared `dockerfiles/base/Dockerfile`: `ward-base`,
  `circleci_ward-base`, `production_ward-base`, `vite_ward-base`.
- Each is built for **amd64 and arm64** by the `release-image` CircleCI matrix through
  `bin/image.sh` (`qemu`, then `push`), tagged `<version>[-arm64]` and `latest[-arm64]`.
- Guards in `bin/image.sh`:
  - `skip_if_not_tag` — images are only pushed from a tag build;
  - `skip_if_unchanged` — skips the push when `dockerfiles/base/` and `bin/image.sh` did not
    change since the previous tag;
  - `FORCE_IMAGE_BUILD` — overrides `skip_if_unchanged`.

## Version rules

- The `version` file holds each base image's version. **The `version` file and every CI pin of
  that image move together**, in the same PR.
- A change to the shared `dockerfiles/base/Dockerfile` affects all four targets, so it means
  **bumping every version**.
- Decision: all four images go from `0.1.0` to **`0.2.0`**, for amd64 and arm64. Every CI pin
  (`circleci_ward-base`, `vite_ward-base`, …) moves to `0.2.0` with it; the stale
  `vite_ward-base:0.0.1` CI pin and the Makefile's `BASE_VERSION` default are aligned too.

## `deploy_frontend.sh`

- It comes from **`darthjee/scripts:0.12.0`** through the images. There is **no repo copy**:
  the current `bin/deploy_frontend.sh` is removed, and every job calls the image's copy.
- `vite_ward-base` copies it from `darthjee/scripts:0.12.0` into `/usr/local/sbin/` (the base
  Dockerfile's `SCRIPTS_IMAGE` moves from `0.8.0` to `0.12.0`).
- `darthjee/tent:1.1.0` already ships it in `/usr/sbin/`, so the proxy upload jobs need nothing
  extra.
- Jobs call it by name (`deploy_frontend.sh <action>`), resolved from `PATH`.

## Not published

- **No published backend image**: Render builds `dockerfiles/production_ward/Dockerfile` itself
  (see [render.md](render.md)).
- **No standalone image**.

## Reference

- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- `darthjee/scripts` 0.12.0 image: https://github.com/darthjee/docker/tree/main/scripts/0.12.0
- Tent image shipping the script: https://github.com/darthjee/tent/blob/main/dockerfiles/tent/Dockerfile, https://github.com/darthjee/tent/issues/298
- Kerghan base-image release: https://github.com/darthjee/kerghan/blob/main/bin/image.sh

## Required tests

Automated:

- Backend and frontend tests and lint stay green on `circleci_ward-base:0.2.0` and the bumped
  images.

Manual (first tag release):

- Docker Hub holds `0.2.0` and `0.2.0-arm64` for all four images.
- `deploy_frontend.sh` resolves on `PATH` inside `vite_ward-base:0.2.0` and `tent:1.1.0`, and
  the repository no longer contains `bin/deploy_frontend.sh`.
- A later tag with no change under `dockerfiles/base/` or `bin/image.sh` skips the pushes.
