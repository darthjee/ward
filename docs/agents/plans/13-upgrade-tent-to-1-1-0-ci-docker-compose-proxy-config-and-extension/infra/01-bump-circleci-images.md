# Bump Tent images in CircleCI

In `.circleci/config.yml`, change the Docker image tag of every Tent-based job from `0.10.4`
to `1.1.0`:

- `proxy_extension_tests` (around line 204): `darthjee/tent-test:0.10.4` →
  `darthjee/tent-test:1.1.0`.
- `upload_proxy_files` (around line 260): `darthjee/tent:0.10.4` → `darthjee/tent:1.1.0`.
- `copy_proxy_configuration` (around line 276): `darthjee/tent:0.10.4` → `darthjee/tent:1.1.0`.
- `upload_extension` (around line 296): `darthjee/tent:0.10.4` → `darthjee/tent:1.1.0`.

Change only the tags. Job steps, `working_directory: /home/app/app`, and the
`bin/deploy_frontend.sh` calls stay as they are. The only exception: if `proxy` reports that
`tent-test:1.1.0` moved `vendor/` or the WORKDIR, adjust the `proxy_extension_tests`
`working_directory` or the phpunit path to match.

## Files to Change

- `.circleci/config.yml` — image tags of `proxy_extension_tests`, `upload_proxy_files`,
  `copy_proxy_configuration` and `upload_extension`.
