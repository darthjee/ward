# Architecture — API Caching Strategy

This page is the single source of truth for how Ward's API responses are cached. Other docs
(proxy, cache warmer, flow, auth routes) link here rather than restating the rules.

## Default: opt-in caching with a per-caller key

Tent's backend rule (`proxy/*_configuration/rules/backend.php`) routes every `*.json` URL to
the NestJS backend through `default_proxy`. Caching is **opt-in**: the rule sets
`'require_cache_header' => 'X-Cache-Allow'`, so a 2xx response is stored only when the backend
sends `X-Cache-Allow`. `'skip_cache_header' => 'X-Skip-Cache'` is still set and always wins: a
response carrying it bypasses the cache entirely.

The cache key is **per caller**. Ward's `AccessTokenRequestHasher`
(`proxy/extension/lib/cache/`) reads the `access_token` cookie and returns
`sha256(access_token + '|' + query)`. With no token it returns the plain query hash, so anonymous
`public` responses stay shared. The raw token is only ever hashed; it never appears in a key or
path. The key still ignores the HTTP method, which is why the backend treats every non-GET/HEAD
request as `never` (see [Response headers](#response-headers)).

Credentials are never stored: `additional_excluded_headers => ['Authorization']` is set on both
the handler and `CacheStalenessMiddleware`; `Set-Cookie` and Tent's other defaults are already
excluded.

## Cache classes

Every API route belongs to exactly one cache class, declared on the backend with
`@CachePolicy(CacheClass.X)` (`backend/src/core/cache-policy.decorator.ts`). The enum lives in
`backend/src/core/cache-class.ts`. The decorator can be applied at controller level or at route
level; a route-level class overrides the controller's.

| Class | Enum | Use it for | Examples |
|---|---|---|---|
| `public` | `CacheClass.Public` | Data identical for every caller, readable by anyone | Reference data readable by anyone (none exist yet) |
| `user-scoped` | `CacheClass.UserScoped` | Data that depends on who the caller is | A user's own saved resources, once any exist |
| `never` | `CacheClass.Never` | Auth, tokens, admin, and operational endpoints | Every `AuthController`, `AdminController` and `AuthorizationRequestController` route; `GET /health.json`, `GET /ready.json` |

How to pick one:

- If the response differs by caller in any way (session, user id, role), it is **not** `public`.
- Auth, token, and admin endpoints are always `never`.
- Operational endpoints (`health.json`, `ready.json`) are always `never`: they must always reach
  the backend, or a cached health/readiness check could report ok while the backend (or its
  database) is down.
- `user-scoped` is cached in the proxy, per caller (see [Per-user cache](#per-user-cache)).
  Logged-in callers' `public` responses are keyed per caller too.
- When in doubt, choose `never`.

**Enforcement:** a backend spec walks every registered controller route and fails when a route
declares no class (`backend/src/core/tests/cache-policy.coverage.spec.ts`).
A route with no class is never cached (no `X-Cache-Allow`), but the spec still fails. The
`cache` agent also reviews, read-only, that every endpoint declares a class, that
`public`/`user-scoped` GETs send `X-Cache-Allow`, and that `never` endpoints and writes send
`X-Skip-Cache`. Neither header is ever set by hand.

## Response headers

The global `CachePolicyInterceptor` sets the headers **before** the handler runs, so errors
thrown by the handler carry them too. Rejections from global guards (`OriginGuard`, `JwtGuard`,
`AdminGuard`) happen before interceptors and carry no cache headers; that is harmless because
Tent only caches 2xx responses.

| Effective class | `X-Cache-Allow` | `X-Skip-Cache` | `Cache-Control` |
|---|---|---|---|
| `public`, GET/HEAD | `true` | *(absent)* | `public, max-age=10` |
| `user-scoped`, GET/HEAD | `true` | *(absent)* | `private, no-store` |
| `never` | *(absent)* | `true` | `no-store` |
| any class, method other than GET/HEAD | *(absent)* | `true` | `no-store` |
| no class declared | *(absent)* | *(absent)* | *(absent)*: not cached, but the coverage spec fails |

Because Tent's cache key ignores the method, **any method other than GET/HEAD is always treated
as `never`**, whatever class the route declares. This is enforced in the backend interceptor
rather than with a method matcher in the proxy rule.

`Cache-Control` is browser-facing guidance; Tent itself decides on `X-Cache-Allow` and
`X-Skip-Cache`. `user-scoped` keeps `private, no-store`, so caching happens in the proxy only,
never in the browser. The last row must never ship: the coverage spec fails first.

## Freshness

Tent's `CacheStalenessMiddleware` (`maxAgeSeconds => 10`) treats entries older than 10 seconds
as stale. A stale entry is **still served**, and a background refresh against the backend is
scheduled (stale-while-revalidate). There is no hard expiry.

The backend's `PUBLIC_MAX_AGE_SECONDS` (`backend/src/core/cache-class.ts`) mirrors this value
for the `public` `Cache-Control: max-age`. Change both together.

`maxAgeSeconds` does **not** bound how long a per-caller entry can be served. A cache hit never
reaches `JwtGuard`, so logout, session revocation, admin demotion and leaving an organization
are not enforced on hits. The bound is the access token's `exp` claim: see
[Expired tokens](#expired-tokens).

## Invalidation

Invalidation is **declared by the backend and carried out by the proxy**, through the
`X-Cache-Invalidate` response header.

**Backend: declaration.** Every write route (any method other than GET/HEAD) declares which
cached GET paths it changes. The decorators live in `backend/src/core/cache-invalidation.decorator.ts`:

| Decorator | Emits | Used by |
|---|---|---|
| `InvalidatesOwner()` | The owner's prefix: `/bank` for a personal write, `/orgs/<organizationId>/bank` for an organization write (id taken from `request.ownerContext`) | Applied by default through `OwnerScopedController` |
| `InvalidatesPaths(build)` | The paths returned by `build(request)` | Organization writes: `POST /orgs.json` gives `/orgs.json`; `PATCH /orgs/:orgId.json` gives `/orgs.json, /orgs/<orgId>.json` (`backend/src/auth/organization-invalidation.ts`) |
| `NoCacheInvalidation()` | Nothing | Auth, authorization-request and admin controllers |

The global `CacheInvalidationInterceptor` (`backend/src/core/cache-invalidation.interceptor.ts`)
sets the header in an rxjs `tap` **after** the handler returns, so a thrown exception (4xx/5xx)
never carries it. It drops any unsafe path (see below). A write never emits the other owner's
prefix, and the backend must **never** emit `/orgs` or `/`: the clear is recursive, so that
would wipe every organization's tree.

**Enforcement:** `cache-policy.coverage.spec.ts` fails when a write route declares no
invalidation, when an owner-scoped route does not resolve to the owner default, or when a
`paths` declaration emits `/` or `/orgs`.

**Header format.** A comma-separated list of absolute paths, e.g.
`X-Cache-Invalidate: /orgs.json, /orgs/3.json`. Each path starts with `/`, is not `/` itself,
and contains no query, fragment, scheme, backslash, NUL, percent-encoding, or empty/`.`/`..`
segment. Invalid entries are ignored; the others are still honoured.

**Proxy: clearing.** Ward's `CacheInvalidationMiddleware`
(`proxy/extension/lib/middlewares/`) runs on the backend rule. When the response is 2xx and the
method is not GET/HEAD, it recursively clears each listed path subtree in the cache folder:
every entry whose path equals the given path or lies under it as a path-segment prefix, for
every query variant, caller and method. `/bank` clears `{cache}/bank/**`, but not
`{cache}/bank.json/**`; `/orgs/3/bank` never touches `/orgs/4/...`. Targets are confined to the
cache folder and symlinks are never followed. The middleware **always** strips the header,
whatever the status or method, so it is neither stored in the cache nor sent to the client.

**Granularity and accepted costs.**

- Invalidation is per owner subtree, not per entity. One personal bank write clears every
  user's `/bank` entries. This is accepted: the clear is cheap, and the next reads repopulate it.
- Race windows are accepted. A GET that misses while a write is in flight, or a
  `BackgroundRefresher` refresh scheduled by `CacheStalenessMiddleware`, can store a value from
  before the write. That heals within about 10 s plus one read.

**Out-of-band writers.** Anything that changes data without going through a backend write route
(manual SQL, scripts, migrations that rewrite data) does not emit the header. Such a writer must
either purge the cache folder itself or only touch data that is never cached. No purge endpoint
is built for now.

Tent's own `CacheCleanupMiddleware` was **removed** from the backend rule. It only cleared the
written path's own collection/entity, so it could not express cross-path effects.

Bank and organization GETs are `user-scoped` and cached per caller, so a write clears every
caller's entries under the owner subtree.

## Navi warm-up

Only `public` GET endpoints may be added to Navi's warm-up resources (`navi/resources/*.yml`).
`never` responses are never stored by Tent. `user-scoped` responses are cached per caller, but
are still never warmed: warming them with a real session would write that session's data to
disk.
Warm-up runs after tagged releases only. See [cache-warmer.md](../cache-warmer.md).

## Per-user cache

`user-scoped` GETs (and logged-in callers' `public` GETs) are cached in Tent under the caller's
`sha256(access_token + '|' + query)` key (see
[Default](#default-opt-in-caching-with-a-per-caller-key)). Only the holder of that exact token
can reach the entry. The key changes whenever the access token rotates (15 minutes by default),
and organization data is cached per member rather than shared; both lower the hit rate, and
that is accepted. No client-supplied identifying header is trusted, and the proxy never needs
the JWT secret.

### Expired tokens

Ward's `ExpiredTokenCacheBypassMiddleware` (`proxy/extension/lib/middlewares/`) runs in the
backend rule's `prependMiddlewares`, i.e. **before** the handler's `FileCacheMiddleware`
(anything in the rule's `middlewares` runs after the cache). It base64url-decodes the access
token's payload, without checking the signature (a forged token hashes to a different key
anyway), and reads `exp`. When the token has expired, or has no readable `exp`, it marks the
request `X-Skip-Cache`, so the request is neither served from the cache nor stored. Requests
with no token are left alone.

After logout or revocation, only someone who still holds the token can get hits, for at most
its remaining life (15 minutes or less by default). Logout also clears the cookie in the
browser. The backend never reads `X-Skip-Cache` from requests, and must not start to.

### Background refresh

Tent's `BackgroundRefresher` (scheduled by `CacheStalenessMiddleware` on a stale hit) replays
the triggering request with that caller's own headers and writes under the same memoized key, so
it can never store a response under another caller's key. An expired-token request never hits,
so it never triggers a refresh. If the token expires between the hit and the refresh, `JwtGuard`
answers 401 and the refresher stores nothing.

Known gap: the refresher ignores `require_cache_header` and `skip_cache_header`. An existing
entry keeps being refreshed if its route later changes to `never`, until the cache folder is
reset (deploy). It can never create an entry that was not opted in. This is accepted; it should
be raised upstream on Tent.

### Query parameters

`filter_query_params` stays unset on the backend rule. It must never drop a parameter that
defines scope, or two scopes would share one key.
