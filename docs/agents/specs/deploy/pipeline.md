# Pipeline

The CircleCI deploy pipeline (`.circleci/config.yml`). Owned by [#13](https://github.com/darthjee/ward/issues/13);
the jobs it wires are specified in [render.md](render.md) and [ssh/](README.md#index).

## Triggers

- Deploy jobs run **only on semver tags**: `tags: only: /\d+\.\d+\.\d+/` with
  `branches: ignore: /.*/` (the existing `&tags_only` anchor). Branch pushes and non-semver tags
  never run a deploy job.
- Test and lint jobs keep running on every branch and every tag (the existing `&all_tags`
  anchor), so a tag build runs them too.

## Requirements

Every deploy job (`build-and-release`, `upload_proxy_files`, `upload_extension`,
`copy_proxy_configuration`, `upload_fe_files`, `release`) **requires the test and lint jobs**:
`backend_tests`, `backend_checks`, `backend_integration`, `jasmine`, `frontend-checks` and
`proxy_extension_tests`. A failing test or lint job blocks the whole deploy.

## Job graph

```
release-image matrix (4 base images x amd64/arm64) + tests + lint
  |-- build-and-release         (Render, watched until live)
  |-- upload_proxy_files        (SSH)
  |-- upload_extension          (SSH)
  |-- copy_proxy_configuration  (SSH)
  `-- upload_fe_files           (SSH)
        all five succeed
          `-- release           (swap, then cleanup)
```

- `build-and-release` requires the `production_ward-base` matrix entries (amd64 and arm64), so
  the base image Render builds from is pushed first.
- `upload_fe_files` and `release` require the `vite_ward-base` matrix entries, since they run in
  that image.
- The SSH upload jobs run in parallel with `build-and-release`.
- `release` requires **every** upload job **and** `build-and-release` (backend live) — see
  [ssh/release.md](ssh/release.md).

## Job images

| Job | Image / executor |
|---|---|
| `release-image` matrix | `machine: true` (Docker + QEMU, see [images.md](images.md)) |
| `build-and-release` | `machine: image: ubuntu-2204:current` (see [render.md](render.md)) |
| `upload_proxy_files`, `upload_extension`, `copy_proxy_configuration` | `darthjee/tent:1.1.0` |
| `upload_fe_files`, `release` | `darthjee/vite_ward-base:0.2.0` |
| `proxy_extension_tests` | `darthjee/tent-test:1.1.0` |
| backend tests/lint | `darthjee/circleci_ward-base:0.2.0` |

Today the SSH jobs run on `tent:0.10.4` and `vite_ward-base:0.0.1`; the pins move as described
in [ssh/proxy.md](ssh/proxy.md) and [images.md](images.md).

## Reference

- Kerghan pipeline: https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml
- Oak pipeline (original SSH pattern): https://github.com/darthjee/oak/blob/main/.circleci/config.yml
- Epic: https://github.com/darthjee/ward/issues/10

## Required tests

Automated:

- The CircleCI config stays valid (`circleci config validate`, through the `circleci` compose
  service) and every test and lint job stays green on branch builds.

Manual (first tag release):

- A branch push or a non-semver tag runs **no** deploy job.
- On a semver tag, no deploy job starts before every test and lint job has passed.
- `release` starts only after all four upload jobs and `build-and-release` succeed.
