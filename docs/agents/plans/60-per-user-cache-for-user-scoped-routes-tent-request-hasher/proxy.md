# Proxy Plan: Per-user cache for user-scoped routes (Tent request_hasher)

Main plan: [plan.md](plan.md)

## Shared contracts

The proxy **consumes** these backend response headers:

- `X-Cache-Allow: true` is sent for `public` and `user-scoped` GET/HEAD. The proxy stores a
  response only when this header is present (`require_cache_header`).
- `X-Skip-Cache: true` is sent for `never` and for every non-GET/HEAD method. It still wins.
- The `access_token` cookie is a JWT with an `exp` claim (default 15 min). Only the payload is
  decoded; the signature is not checked.

The proxy **produces**:

- The cache key `sha256(access_token . '|' . query)`. With no token, it is
  `sha256(query)`, identical to `QueryRequestHasher`.
- For requests whose token is expired or has no readable `exp`, the request header
  `X-Skip-Cache: 1` on the forwarded request. The backend ignores it.

Rule config in both `proxy/dev_configuration/rules/backend.php` and
`proxy/prod_configuration/rules/backend.php`:

```php
'handler' => [
    'type' => 'default_proxy',
    'host' => ...,
    'skip_cache_header' => 'X-Skip-Cache',
    'require_cache_header' => 'X-Cache-Allow',
    'request_hasher' => ['class' => 'Tent\\Cache\\AccessTokenRequestHasher'],
    'additional_excluded_headers' => ['Authorization'],
],
'prependMiddlewares' => [
    ['class' => 'Tent\\Middlewares\\ExpiredTokenCacheBypassMiddleware'],
],
'middlewares' => [
    // SetClientIp, CacheCleanup unchanged
    // CacheStaleness: add 'additional_excluded_headers' => ['Authorization']
],
```

**Do not merge before #61 is merged.** #61 also touches these rule files, so rebase on it.

## Steps

- [01 — Shared access-token cookie reader](proxy/01-access-token-reader.md)
- [02 — AccessTokenRequestHasher](proxy/02-access-token-request-hasher.md)
- [03 — ExpiredTokenCacheBypassMiddleware](proxy/03-expired-token-cache-bypass-middleware.md)
- [04 — Wire the rules and loader](proxy/04-wire-rules-and-loader.md)

## CI Checks

- `proxy/extension`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `proxy`: `docker-compose run --rm proxy_lint` (phpcs, root `phpcs.xml`)

## Notes

- Verified against the Tent 1.1.0 sources:
  - `RequestHandler::build` adds the handler's own middlewares (including
    `FileCacheMiddleware`) first, then `prependMiddlewares`, then the rule's `middlewares`.
    Despite its name, `prependMiddlewares` is the only place that runs before the cache read;
  - the rule's `middlewares` run after it;
  - check this ordering in step 04 with a quick read of `RequestHandler::build` and, if
    possible, with a manual request.
- `FileCacheMiddleware` checks the skip header on both the **request** (read and write) and
  the response (write). `$response->request()` is the same mutated `ProcessingRequest`, so a
  request-side `X-Skip-Cache` blocks both the read and the write.
- `CacheStalenessMiddleware` builds `FileCache` without a hasher. It reuses the memoized
  `cacheHash()` computed by `FileCacheMiddleware`, so the per-user key flows through to the
  background refresh.
- Do not strip the cookie for expired tokens. That would fall back to the shared anonymous key
  and break the backend's 401/refresh flow.
- `filter_query_params` stays unset. Add a comment in the rule saying that, if it is ever
  added, it must never drop a scope-defining param (for example an org id).
- `Authorization` is a request header and `FileCache` stores only response headers, so
  `additional_excluded_headers` is defense in depth.
- Follow-up (not in scope): raise on Tent that `BackgroundRefresher` ignores
  `skip_cache_header` and `require_cache_header`.
