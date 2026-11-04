# Bump the base images
Upgrade the scripts stage and install the deploy script into `vite_ward-base`, then bump every image version.

- `dockerfiles/base/Dockerfile` L11: `ARG SCRIPTS_IMAGE=darthjee/scripts:0.12.0` (was `0.8.0`;
  `yarn_builder.sh` is identical from 0.9.0 to 0.12.0, so the `builder` stage COPY at L53 stays).
- In the `vite_ward-base` target (L85), add
  `COPY --from=scripts /home/scripts/sbin/deploy_frontend.sh /usr/local/sbin/deploy_frontend.sh`
  (verify the source path first, see infra.md Notes) and ensure it is executable.
- `version`: set `ward-base`, `circleci_ward-base`, `production_ward-base`, `vite_ward-base` to `0.2.0`.
- `Makefile` L5: `BASE_VERSION?=0.2.0` (was `0.0.1`).

## Files to Change
- `dockerfiles/base/Dockerfile` — scripts image 0.12.0; copy `deploy_frontend.sh` into `vite_ward-base`.
- `version` — all four images to `0.2.0`.
- `Makefile` — `BASE_VERSION` default `0.2.0`.
