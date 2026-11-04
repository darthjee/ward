# Switch deploy jobs to the image script
Replace every `bin/deploy_frontend.sh` call with `deploy_frontend.sh` from `PATH`, and every
`generate_key_file` step with `- setup_ssh`, in the five SSH jobs:

- `upload_proxy_files` (L259): `setup_ssh`, then `SOURCE=/var/www/html/ deploy_frontend.sh upload`.
- `copy_proxy_configuration` (L275): `setup_ssh`, then the existing `upload` and two `copy_files` calls.
- `upload_extension` (L295): `setup_ssh`; remove the "Remove test files" step (`rm -rf proxy/extension/tests/`,
  L304-306); upload with
  `SOURCE=proxy/extension/ DEPLOY_PATH=extension/ EXCLUDE_FROM=proxy/extension.exclude deploy_frontend.sh upload`.
- `upload_fe_files` (L313): `build`, `setup_ssh`, drop the `DEPLOY_PATH=static/ generate_folder` step (L328;
  `upload` now creates the folder), then `SOURCE=dist/ DEPLOY_PATH=static/ deploy_frontend.sh upload`.
  Note `setup_project dir: frontend` — make sure the call does not rely on a repo-relative `bin/` path.
- `release` (L337): `setup_ssh`, then `KEEP_OLD=true deploy_frontend.sh release`, then a new step
  `deploy_frontend.sh cleanup` (default `CLEANUP_MAX_AGE_MINUTES`=1440).

Then delete `bin/deploy_frontend.sh` and grep the repo (`.circleci`, `scripts/`, `bin/`, `Makefile`,
`docker-compose.yml`) to confirm nothing references it.

## Files to Change
- `.circleci/config.yml` — SSH jobs use `setup_ssh` and the PATH script; `EXCLUDE_FROM`, `KEEP_OLD`, `cleanup`.
- `bin/deploy_frontend.sh` — deleted.
