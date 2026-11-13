# Proxy Plan: Cache invalidation on writes, including cross-path effects

Main plan: [plan.md](plan.md)

## Shared contracts

What this agent can rely on, and what it must honour:

- The backend sends `X-Cache-Invalidate: <path>[, <path>…]` on successful writes only. The proxy
  still checks the status itself.
- **Header handling:** match the name case-insensitively. Split the value on `,` and trim each
  entry.
- **Honour the header** only when `$response->isSuccessful()` (200–299) **and** the request
  method (`$response->request()->requestMethod()`) is not GET or HEAD.
- **Always strip** the header from the response.
- **Path validity:** a path is valid only when it:
  - starts with `/`;
  - contains no `?`, `#`, `\`, NUL, `://` or `%`;
  - has no empty, `.` or `..` segment after splitting on `/`;
  - is not `/`.

  Invalid entries are ignored one by one.
- **Clear semantics:** a recursive clear of the subtree `{location}/{segments…}`, which covers
  every method or `GET` directory under it, including all hashes and `.refreshing` sentinels.
- **Confinement:** the target must sit strictly inside the cache location, checked by `realpath`
  prefix. Symlinks are unlinked and never followed.

## Steps

- [01 — Add CacheInvalidationMiddleware](proxy/01-cache-invalidation-middleware.md)
- [02 — PHPUnit tests for the middleware](proxy/02-phpunit-tests.md)
- [03 — Wire it into the backend rules](proxy/03-backend-rules.md)

## CI Checks

- `proxy/extension`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `proxy`: `docker-compose run --rm proxy_lint` (phpcs PSR-12)

## Notes

- **Middleware order.** Rule `middlewares` are appended **after** the handler's
  `FileCacheMiddleware`, and `processResponse` runs in the same order. Register the new middleware
  under the rule's `prependMiddlewares` key so it strips the header before `FileCacheMiddleware`
  could store it. Also add `'additional_excluded_headers' => ['X-Cache-Invalidate']` to the
  handler as a second layer.
- **Writes are not cached.** The backend's `X-Skip-Cache` on every non-GET already keeps write
  responses out of the cache.
- **Cache hits.** `processResponse` also runs on cache hits. The non-GET/HEAD check stops a
  replayed header from ever triggering a clear.
- **Accepted gap.** If the upstream commits but the proxy sees a 5xx, a timeout or a curl error,
  nothing is cleared. The issue accepts this in its race-window decision.
- **Path encoding.** Tent stores paths raw, without URL-decoding. Rejecting `%` keeps the header
  paths and the stored layout aligned.
- **`DomainHash` is not wired into any rule today.** If it ever is, the clear must cover each
  domain folder.
