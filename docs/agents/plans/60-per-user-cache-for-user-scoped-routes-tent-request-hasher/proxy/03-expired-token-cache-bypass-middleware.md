# ExpiredTokenCacheBypassMiddleware

Create `Tent\Middlewares\ExpiredTokenCacheBypassMiddleware extends Middleware` in
`proxy/extension/lib/middlewares/`. Follow the pattern of the existing middlewares: a static
`build(array $attributes)` that accepts both camelCase and snake_case keys, and a long
docblock.

- Options:
  - `skipCacheHeader` / `skip_cache_header` (default `X-Skip-Cache`; it must match the
    handler's `skip_cache_header`);
  - `cookie` / `cookieName` (default `access_token`).
- `processRequest(ProcessingRequest $request)`:
  - reads the token via `AccessTokenCookie::token()`;
  - with no token, returns the request unchanged (the anonymous shared key applies);
  - when a token is present and `AccessTokenCookie::isUsable()` is false (expired, or no
    readable `exp`), sets the request header `<skipCacheHeader>: 1`;
  - never sets a response, so the chain continues to `FileCacheMiddleware`.
- `processResponse`: pass-through.

Explain in the docblock why the header bypasses the cache, and why the middleware must be in
the rule's `prependMiddlewares`:

- `FileCacheMiddleware` skips the read on a request-side skip header, and skips the write
  because `$response->request()` carries it;
- with no hit, `CacheStalenessMiddleware` never schedules a background refresh.

Tests in `proxy/extension/tests/middlewares/ExpiredTokenCacheBypassMiddlewareTest.php`:

- an expired token sets the header;
- a token with no `exp` sets the header;
- a malformed token sets the header;
- a valid future token leaves the headers unchanged;
- no cookie leaves the headers unchanged;
- a custom header name and cookie name are honoured;
- the middleware never sets a response.

Add one integration-style test with a real `Tent\Middlewares\FileCacheMiddleware` (temp dir
`location`, `skip_cache_header => 'X-Skip-Cache'`, `require_cache_header => 'X-Cache-Allow'`,
the hasher from step 02). It shows that, after this middleware ran on an expired-token request:

- an existing entry for that key is not served;
- a 2xx response with `X-Cache-Allow` is not stored.

Also add the control case: with a valid token, the entry is stored and then served.

## Files to Change
- `proxy/extension/lib/middlewares/ExpiredTokenCacheBypassMiddleware.php` — new middleware
- `proxy/extension/tests/middlewares/ExpiredTokenCacheBypassMiddlewareTest.php` — new tests
- `proxy/extension/loader.php` — `require_once` after `AccessTokenCookie.php`
