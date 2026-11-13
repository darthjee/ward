# Plan: Per-user cache for user-scoped routes (Tent request_hasher)

Issue: [60-per-user-cache-for-user-scoped-routes-tent-request-hasher.md](../../issues/60-per-user-cache-for-user-scoped-routes-tent-request-hasher.md)

## Overview

Cache `user-scoped` (and logged-in `public`) API responses in Tent, keyed per caller. The key is
`sha256(access_token + '|' + query)`. With no token, the plain query hash is used. Caching
becomes opt-in: the backend sends `X-Cache-Allow` for `public` and `user-scoped`, and the proxy
rule sets `require_cache_header => 'X-Cache-Allow'`. A proxy middleware that runs **before** the
cache marks requests that carry an expired or `exp`-less access token as `X-Skip-Cache`. Such a
request is neither served from the cache nor stored, and it never triggers a background refresh.

**Prerequisite: #61 (cross-path invalidation on writes) must be merged before this lands.** It is
still open. Until it is merged, `user-scoped` keeps sending `X-Skip-Cache`, so implementation
must not start (or at least must not merge) before #61.

## Agents involved

- [proxy](proxy.md): hasher, expired-token middleware, rule config, PHPUnit tests
- [backend](backend.md): `CacheClass` headers, interceptor and specs

Not split into agent files, owned by the architect or review-only:

- **architect**: documentation (see [Documentation](#documentation-architect) below)
- **cache**: read-only review of the new contract after backend and proxy finish
- **security**: read-only review, because this changes proxy rules and auth-adjacent caching

Suggested order: proxy and backend can run in parallel (the contract below is fixed), then
the docs, then `cache` + `security` review.

## Shared contracts

### Response headers (backend produces, proxy consumes)

| Effective class | `X-Cache-Allow` | `X-Skip-Cache` | `Cache-Control` |
|---|---|---|---|
| `public`, GET/HEAD | `true` | *(absent)* | `public, max-age=10` |
| `user-scoped`, GET/HEAD | `true` | *(absent)* | `private, no-store` |
| `never` | *(absent)* | `true` | `no-store` |
| any class, method other than GET/HEAD | *(absent)* | `true` | `no-store` |
| no class declared | *(absent)* | *(absent)* | *(absent)* (not cached under `require_cache_header`; the coverage spec still fails) |

- Header names are exact: `X-Cache-Allow` and `X-Skip-Cache`. Value `true` for both.
- Tent: `skip_cache_header` still wins over `require_cache_header`.

### Proxy rule config (both `dev_configuration` and `prod_configuration` `rules/backend.php`)

- Handler (`default_proxy`):
  - `'skip_cache_header' => 'X-Skip-Cache'` (unchanged)
  - `'require_cache_header' => 'X-Cache-Allow'`
  - `'request_hasher' => ['class' => 'Tent\\Cache\\AccessTokenRequestHasher']`
  - `'additional_excluded_headers' => ['Authorization']`
- Rule-level `'prependMiddlewares'`: `Tent\Middlewares\ExpiredTokenCacheBypassMiddleware`. It runs
  before the handler's `FileCacheMiddleware`. Anything in the rule's `middlewares` runs **after**
  the cache, so this placement is required.
- `CacheStalenessMiddleware`: add `'additional_excluded_headers' => ['Authorization']`.
- `filter_query_params` stays unset.

### Access token (backend produces, proxy reads)

- The cookie is named `access_token` (`backend/src/auth/auth-response.ts`). It is an HS256 JWT with
  an `exp` claim, set by jsonwebtoken from `WARD_ACCESS_TOKEN_TTL_MS` (default 15 min).
- The proxy only base64url-decodes the payload. It never checks the signature and never needs the
  JWT secret.
- The backend never reads `X-Skip-Cache` from **requests**. The proxy middleware sets it on the
  forwarded request, and that must stay harmless (do not start reading it in the backend).

## Background refresh analysis (decision required by the issue)

Read from Tent 1.1.0 (`service/BackgroundRefresher.php`, `middlewares/CacheStalenessMiddleware.php`,
`content/FileCache.php`):

- A refresh is scheduled only on a **cache hit** that is stale. An expired-token request never
  hits, because the middleware forces `X-Skip-Cache` and `FileCacheMiddleware` skips the read.
  So an expired token can never trigger a refresh.
- The refresh replays the caller's own headers (Cookie included) and writes under the memoized
  `cacheHash()` of the same request. It cannot write under another caller's key.
- If the token expires between the hit and the refresh (milliseconds apart), `JwtGuard` returns
  401. That is non-2xx, so the refresher keeps the stale entry and stores nothing.
- Residual gap: the refresher ignores `skip_cache_header` and `require_cache_header`. An entry
  that already exists keeps being refreshed if its route later changes to `never`, until the
  cache folder is reset (deploy). It can never create an entry that was not opted in. This is
  accepted here. Raise it upstream on Tent as a follow-up issue and do not block on it.

## Documentation (architect)

Update after backend and proxy are done:

- `docs/agents/architecture/caching.md`:
  - "Default" becomes opt-in caching with a per-caller key;
  - update the classes table guidance;
  - replace the *Response headers* table with the contract above;
  - *Freshness*: the revocation window is bounded by the token `exp`, not `maxAgeSeconds`;
  - *Navi warm-up*: user-scoped is still never warmed;
  - replace *Future* with the per-user cache description and the refresher gap;
  - fix the "Enforcement" note about what the `cache` agent reviews.
- `docs/agents/flow.md`: rewrite *Per-user cache (upcoming)* as current behaviour (keep the
  anchor or update the links in `caching.md` and `cache-warmer.md`).
- `docs/agents/cache-warmer.md`: the user-scoped section now describes `X-Cache-Allow` and the
  per-caller key, and that Navi still never warms user-scoped data.
- `docs/agents/architecture/proxy.md`:
  - the *Cache bypass* section;
  - new subsections for the request hasher, the expired-token middleware (and why it sits in
    `prependMiddlewares`), and `require_cache_header`;
  - `filter_query_params` must never drop scope params.
- `.claude/agents/cache.md` and `.github/agents/cache.agent.md`: description and review rules
  move to the new contract. `public`/`user-scoped` GET send `X-Cache-Allow`; `never` and writes
  send `X-Skip-Cache`; nothing is set by hand.
- `.claude/agents/architect.md`, `.github/agents/architect.agent.md`: the
  `cache` scope line "`X-Skip-Cache` review" becomes "cache-header (`X-Cache-Allow` /
  `X-Skip-Cache`) review", and so does the "Cache warm-up review" paragraph.
- `.github/agents/proxy.agent.md` (*Cache bypass*), `.github/agents/backend.agent.md` (line
  ~132, never set `X-Cache-Allow`/`X-Skip-Cache` by hand), `.github/agents/security.agent.md`
  (line ~59) and their `.claude/agents/` counterparts: align their wording.

## Notes

- Hit rate drops when the token rotates (every ~15 min), and organization data is cached per
  member. The issue accepts both.
- Every user-scoped e2e spec that asserts `x-skip-cache: 'true'` on a GET flips (see
  [backend.md](backend.md)). This is expected churn, not a regression.
- A client can send its own `X-Skip-Cache` request header. That only bypasses the cache for that
  request, which is harmless.
- End-to-end acceptance checks through the proxy (two users get their own data, logout gets no
  cached data, `Authorization` is never stored) are manual or run in a docker-compose session.
  No automated cross-service test exists for them.
