# Shared access-token cookie reader

The hasher and the expired-token middleware both need the `access_token` cookie, and the
middleware also needs its `exp`. Put that logic in one helper so the two can never disagree.

Create `Tent\Cache\AccessTokenCookie` in `proxy/extension/lib/cache/`. Follow the style of
`DomainHash.php`: a static helper with a long docblock. It provides:

- `token(RequestInterface $request, string $cookieName = 'access_token'): ?string`:
  - finds the `Cookie` request header case-insensitively;
  - splits it on `;`, trims each pair and splits it on the first `=`;
  - returns the value for `$cookieName`, URL-decoded. It returns `null` when the header or the
    cookie is missing, or the value is empty.
- `expiresAt(string $token): ?int`:
  - splits the token on `.` and needs 3 parts;
  - base64url-decodes the payload (`strtr` `-_` to `+/` and pad), then `json_decode` it as an
    array;
  - returns `exp` when it is an int, or a numeric value, and `null` otherwise. It never throws.
- `isUsable(string $token, ?int $now = null): bool`: `expiresAt` is not null and greater than
  `$now ?? time()`.

The signature is never checked, and that is documented in the docblock: a forged token hashes
to its own key, which only the forger holds.

Tests in `proxy/extension/tests/cache/AccessTokenCookieTest.php` (namespace
`Tent\Cache\Tests`). Build the request with a real `Tent\Models\ProcessingRequest` and
`headers`, or add a support double in `tests/support/` required from `tests/bootstrap.php`.
Cover:

- parsing among several cookies;
- a lower-case `cookie` header key;
- a missing header or cookie;
- a valid future `exp`, a past `exp` and no `exp`;
- a malformed token (wrong segment count, bad base64, non-JSON);
- a non-numeric `exp`.

Generate the JWT fixtures inline as base64url(header).base64url(payload).signature.

## Files to Change
- `proxy/extension/lib/cache/AccessTokenCookie.php` — new helper
- `proxy/extension/tests/cache/AccessTokenCookieTest.php` — new tests
- `proxy/extension/loader.php` — `require_once` the new file, before its consumers
- `proxy/extension/tests/support/*` and `proxy/extension/tests/bootstrap.php` — only if a request double is needed
