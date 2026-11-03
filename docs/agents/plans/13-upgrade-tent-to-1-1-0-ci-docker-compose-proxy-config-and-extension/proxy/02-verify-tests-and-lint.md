# Verify extension tests and lint on tent-test 1.1.0

After `infra` bumps `docker-compose.yml`, run `.claude/scripts/check_proxy.sh` (or
`docker-compose run --rm proxy_tests` and `docker-compose run --rm proxy_lint` separately) and
fix whatever the new `tent-test` base (`dev_tent-base:0.1.0`) breaks. Most likely failure
points, in order:

1. **`vendor/` location / WORKDIR.** Both commands call `vendor/bin/phpunit` and
   `vendor/bin/phpcs` by relative path. If they are not found, locate them inside the image
   (for example `docker-compose run --rm --entrypoint sh proxy_tests -c 'pwd; ls'`) and hand
   the new path to `infra` (compose + CI command fix).
2. **`Tent\Models\RequestInterface` changes.**
   `proxy/extension/tests/support/DomainHashTestRequest.php` implements it. If 1.1.0 added or
   removed a method, or changed a signature or return type, PHP fatals at load time. Align the
   test double with the 1.1.0 interface.
   - Also refresh its docblock (lines 12-13), which says `tent-test`'s bundled Tent lacks
     `domain()`, if that is no longer true.
3. **`/var/www/html/loader.php`.** `tests/bootstrap.php` requires it and expects it to load
   `/var/www/html/extension/loader.php`. Confirm that this still holds.
4. **Newer PHPCS / PHPUnit.** Fix any new PSR-12 findings in `proxy/`. If the PHPUnit major
   version changed, update the schema path in `proxy/extension/phpunit.xml` only if it is
   broken.

If nothing fails, this step changes no files. Record the passing run in the PR description.

## Files to Change

Only if verification fails:

- `proxy/extension/tests/support/DomainHashTestRequest.php` — align with the 1.1.0
  `RequestInterface`, and refresh the docblock if stale.
- `proxy/extension/tests/bootstrap.php` — only if the Tent loader path changed.
- `proxy/extension/phpunit.xml` — only if the schema path no longer resolves.
- Files under `proxy/` flagged by the new PHPCS — style fixes only.
