# Plan: TS18036 — `AccountService` fails to build: class decorator combined with `static #private`

Issue: [114-fix-image-build.md](../../issues/114-fix-image-build.md)

## Overview
`nest build` fails with TS18036 because the decorated `AccountService` declares two `static #private` helpers, which blocks the production image and the Render deploy. The backend agent moves both helpers to file-private module-level functions and adds an ESLint `no-restricted-syntax` rule that bans `static #private` members in decorated classes. The infra agent adds a per-push `backend_build` CircleCI job running `yarn build`, and makes every tag-only release/upload job require it, so this class of error fails CI before a release tag is pushed.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)

## Shared contracts

- `backend/package.json` script `build` (`"build": "nest build"`, uses `tsconfig.build.json`) stays the build entry point. CI calls it via `yarn_project`'s `npm run build`. Backend must not rename or remove it.
- `yarn build` must exit 0 and emit `dist/main.js` once the backend fix lands. The new CI job only goes green after the backend change, so both changes ship in the same PR.
- New CI job instance name: `backend_build` (`dir: backend`, `image: darthjee/circleci_ward-base:0.1.0`, `script: build`, `step_name: Build`). It is added to the `requires` of `build-and-release`, `upload_proxy_files` and `upload_fe_files`.
- Out of scope for both agents: type errors in backend test files and type-checking tests in CI (#115), the version bump/release, and moving the `circleci_ward-base` pin to 0.2.0.
