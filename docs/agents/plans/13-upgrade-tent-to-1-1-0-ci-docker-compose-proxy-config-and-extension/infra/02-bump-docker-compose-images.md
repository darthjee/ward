# Bump Tent images in docker-compose

In `docker-compose.yml`, move the three Tent services to `1.1.0` so local dev matches CI and
production:

- `ward_proxy` (around line 125): `darthjee/tent:0.10.4` → `darthjee/tent:1.1.0`.
- `proxy_tests` (around line 143): `darthjee/tent-test:0.10.4` → `darthjee/tent-test:1.1.0`.
- `proxy_lint` (around line 150): `darthjee/tent-test:0.10.4` → `darthjee/tent-test:1.1.0`.

Verify:

1. Run `make dev-up`. The frontend loads through `ward_proxy`, and a `*.json` request reaches
   the backend.
2. Static assets now answer with `ETag` / `Last-Modified`, and conditional GETs return `304`.
   This is expected.
3. Hand over to `proxy` for the test/lint verification.

The mounts under `/var/www/html/` (`static/`, `configuration/`, `cache/`, `extension`) are
expected to stay valid.

## Files to Change

- `docker-compose.yml` — image tags of `ward_proxy`, `proxy_tests` and `proxy_lint`. Adjust
  the commands only if `proxy` reports that the `tent-test` `vendor/` path or WORKDIR moved.
