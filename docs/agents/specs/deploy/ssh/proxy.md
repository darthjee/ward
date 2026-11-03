# SSH: proxy

The Tent proxy files on the SSH host. Tent pins are owned by
[#13](https://github.com/darthjee/ward/issues/13); the upload jobs and `EXCLUDE_FROM` by
[#15](https://github.com/darthjee/ward/issues/15).

## Tent 1.1.0

- `darthjee/tent:1.1.0` and `darthjee/tent-test:1.1.0` (multi-arch), **pinned everywhere**: the
  CircleCI jobs and `docker-compose.yml` (`ward_proxy`, `proxy_tests`, `proxy_lint`), replacing
  `0.10.4`.

## Upload jobs

All run in `darthjee/tent:1.1.0` and start with `setup_ssh` ([staging.md](staging.md)).

| Job | Uploads | `DEPLOY_PATH` |
|---|---|---|
| `upload_proxy_files` | Tent itself (`/var/www/html/` from the image) | release root |
| `upload_extension` | `proxy/extension/` | `extension/` |
| `copy_proxy_configuration` | `proxy/prod_configuration/`, then `copy_files` | `configuration/` |

## Host-only files

- `configuration/locals.php` (secrets, backend URL) and `.htaccess` exist **only on the host**,
  never in the repository (the repo holds `locals.php.sample`).
- `copy_proxy_configuration` carries them from the live release into staging with
  `deploy_frontend.sh copy_files` (`TARGET` = those two paths).

## Extension exclude

- Decision: `proxy/extension.exclude`, containing `tests/`.
- It sits **outside** the uploaded tree (`proxy/extension/`), so it is never uploaded itself.
- `upload_extension` runs with `EXCLUDE_FROM=proxy/extension.exclude` (rsync `--exclude-from`,
  patterns relative to `proxy/extension/`), replacing today's `rm -rf proxy/extension/tests/`.

## Reference

- Tent image: https://github.com/darthjee/tent/blob/main/dockerfiles/tent/Dockerfile, https://github.com/darthjee/tent/issues/298
- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- Kerghan pipeline: https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml
- Oak pipeline: https://github.com/darthjee/oak/blob/main/.circleci/config.yml

## Required tests

Automated:

- `proxy_extension_tests` stays green on `tent-test:1.1.0`.

Manual (first tag release):

- The live dir holds the preserved `configuration/locals.php` and `.htaccess`.
- The live dir has `extension/` but **no** `extension/tests/`, and no `extension.exclude`.
- The site answers through Tent 1.1.0.
