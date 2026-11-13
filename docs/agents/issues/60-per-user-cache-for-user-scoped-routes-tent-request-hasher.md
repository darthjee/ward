# Issue: Per-user cache for user-scoped routes (Tent request_hasher)

## Description

Today, `user-scoped` routes are never cached. `@CachePolicy(CacheClass.UserScoped)` sends
`X-Skip-Cache` because Tent's default cache key (`QueryRequestHasher`) is the SHA-256 of the
**query string only**. Without that header, user A and user B would share one cache entry for
`GET /api/bank/accounts.json`. `docs/agents/architecture/caching.md` (*Future*) and
`docs/agents/flow.md` (*Per-user cache, upcoming*) plan to replace this once Tent supports a
per-user cache.

Tent now supports one. Ward runs `darthjee/tent:1.1.0`, which accepts a custom `request_hasher`,
a `require_cache_header` opt-in and `additional_excluded_headers` (see
`docs/agents/external/tent/cache-configuration.md` and `creating-request-hashers.md`). This issue
caches user-scoped responses per caller, in the proxy.

## Decisions

- **Cache key: `sha256(access_token)`.**
  - A custom `RequestHasher` in `proxy/extension/lib/cache/` reads the `access_token` cookie from
    the `Cookie` header and returns `sha256(token + '|' + query)`.
  - With no token, it returns the plain query hash, so anonymous `public` responses stay shared.
  - The token is only ever hashed, never written raw into a key or path (see
    `creating-request-hashers.md` § Security).
  - Only the holder of that exact token can reach the entry. The key changes when the access
    token rotates (15 minutes by default), and organization data is cached per member, not
    shared. Both lower the hit rate, and that is accepted.
  - No client-supplied identifying header is trusted, and the proxy does not need the JWT
    secret.
- **Revocation window: bounded by the token's `exp`.**
  - A cache hit never reaches `JwtGuard`, so logout, session revocation, admin demotion and
    leaving an organization are not enforced on hits.
  - The proxy reads the `exp` claim of the access-token JWT. The payload is only decoded; the
    signature is not checked, because a forged token hashes to a different key anyway. Once the
    token has expired, a request with it is neither served from the cache nor stored. A token
    with no readable `exp` is treated the same way.
  - So after logout or revocation, only someone who still holds the token gets hits, for at most
    its remaining life (≤ 15 min by default). Logout already clears the cookie in the browser.
  - `CacheStalenessMiddleware` is stale-while-revalidate with no hard expiry, so `maxAgeSeconds`
    does not bound this window. The `exp` check does.
  - The plan picks the mechanism, for example a proxy middleware placed before the cache that
    makes the request uncacheable when the token has expired.
- **Backend contract: an opt-in header.**
  - The backend rule adds `require_cache_header => 'X-Cache-Allow'`, so a response is stored only
    when the backend opts in. `skip_cache_header => 'X-Skip-Cache'` stays and still wins.
  - `CacheClass.Public` and `CacheClass.UserScoped` send `X-Cache-Allow`. `CacheClass.Never`
    keeps sending `X-Skip-Cache`, as does any non-GET/HEAD method.
  - Logged-in callers' `public` responses are therefore cached per caller too. That is accepted.
  - The browser `Cache-Control` for `user-scoped` stays `private, no-store`, so caching happens in
    the proxy only.
  - `additional_excluded_headers => ['Authorization']`, set on both the handler and
    `CacheStalenessMiddleware`, so credentials are never stored. `Set-Cookie` and the other
    defaults are already excluded.
- **Background refresh.**
  - Tent's `BackgroundRefresher` replays the triggering request with its own headers, so a
    per-caller entry is refreshed with **that caller's** cookie and written back under the same
    memoized key. It can never store a response under another caller's key.
  - The refresher stores **any** 2xx and does not check `require_cache_header` or
    `skip_cache_header`. The plan must check that this is harmless here: a route only has an
    entry if it opted in, and the expired-token rule must cover refreshes too. If needed, raise
    it upstream on Tent.
- **Ordering: #61 lands first.**
  - Cross-path invalidation on writes (#61) must be merged before this issue.
  - Until then, `user-scoped` routes keep sending `X-Skip-Cache`.
- **Navi** still warms nothing user-scoped. Warming with a real session would put that session's
  data on disk.

## Scope

- **`proxy` agent:**
  - `proxy/prod_configuration/rules/backend.php` and the dev rule: `request_hasher`,
    `require_cache_header` and `additional_excluded_headers`;
  - the hasher, plus the expired-token handling, in `proxy/extension/`, registered in
    `loader.php`, with PHPUnit tests;
  - `filter_query_params` must never drop a parameter that defines scope.
- **`backend` agent:**
  - the `CacheClass` headers in `backend/src/core/cache-class.ts` and
    `cache-policy.interceptor.ts` (`X-Cache-Allow` for `public` and `user-scoped`), with their
    specs;
  - the cache-policy coverage spec, kept in line.
- **Docs:**
  - `docs/agents/architecture/caching.md`: replace *Future*, and update the classes table,
    *Response headers* and *Freshness*;
  - `docs/agents/flow.md` (*Per-user cache*), `docs/agents/cache-warmer.md` and
    `docs/agents/architecture/proxy.md`;
  - the `cache` agent's rule that `user-scoped` must send `X-Skip-Cache` (in
    `.claude/agents/cache.md` and `.github/agents/`) changes to the new contract.
- The `cache` agent reviews the result.

## Out of scope

- Cross-path invalidation and the `custom` cleanup map: #61.
- Verifying the JWT signature in the proxy.
- Warming user-scoped data in Navi.

## Depends on

- #61 (cache invalidation on writes, including cross-path effects).

## Acceptance criteria

- PHPUnit tests cover the hasher:
  - the same token and query give the same key;
  - different tokens give different keys;
  - no token gives the shared query key;
  - the raw token never appears in the returned key.
- PHPUnit tests cover the expired-token handling: an expired token, or one without `exp`, is
  neither served from the cache nor stored.
- Backend specs cover the headers: `public` and `user-scoped` send `X-Cache-Allow`, while `never`
  and writes send `X-Skip-Cache`.
- Through the proxy:
  - two users requesting the same `user-scoped` URL get their own data;
  - a logged-out request gets no cached data;
  - `Authorization` is never stored.
- The docs above describe the new model, and the existing proxy and backend tests pass.

## Related

- #46 (organizations backend) centralizes the `user-scoped` class of every owner-scoped route in
  `@OwnerScopedController`, so bank routes switch mechanism in one place.
- Reference model: majora caches private data with `request_hasher`, `require_cache_header` and
  `additional_excluded_headers`.
