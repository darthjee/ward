# Architecture — API Caching Strategy

This page is the single source of truth for how Ward's API responses are cached. Other docs
(proxy, cache warmer, flow, auth routes) link here rather than restating the rules.

## Default: opt-out shared caching

Tent's backend rule (`proxy/*_configuration/rules/backend.php`) routes every `*.json` URL to
the NestJS backend through `default_proxy`. It **shared-caches every 2xx response by default**:
caching is opt-out, not opt-in.

The Tent cache key is built from the path and query string only. It **ignores the HTTP method**
and the caller (cookies, `Authorization`). A cached `GET /me.json` would be served to every
other caller, and a cached `POST` response could be served for a later `GET` to the same URL.
The only protection is the `X-Skip-Cache` response header: Tent's rule sets
`'skip_cache_header' => 'X-Skip-Cache'`, and any response carrying it bypasses the cache
entirely.

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
- `user-scoped` stays uncached until Tent supports a per-user cache (see [Future](#future)).
- When in doubt, choose `never`.

**Enforcement:** a backend spec walks every registered controller route and fails when a route
declares no class (`backend/src/core/tests/cache-policy.coverage.spec.ts`).
A new endpoint cannot silently fall into Tent's opt-out default. The `cache` agent also
reviews, read-only, that every endpoint declares a class and that `never`/`user-scoped`
endpoints send `X-Skip-Cache`.

## Response headers

The global `CachePolicyInterceptor` sets the headers **before** the handler runs, so errors
thrown by the handler carry them too. Rejections from global guards (`OriginGuard`, `JwtGuard`,
`AdminGuard`) happen before interceptors and carry no cache headers; that is harmless because
Tent only caches 2xx responses.

| Class | `X-Skip-Cache` | `Cache-Control` |
|---|---|---|
| `public` (GET/HEAD) | *(absent)* | `public, max-age=10` |
| `user-scoped` | `true` | `private, no-store` |
| `never` | `true` | `no-store` |
| any class, method other than GET/HEAD | `true` | `no-store` |
| no class declared | *(absent: Tent's opt-out default)* | *(absent)* |

Because Tent's cache key ignores the method, **any method other than GET/HEAD is always treated
as `never`**, whatever class the route declares. This is enforced in the backend interceptor
rather than with a method matcher in the proxy rule.

`Cache-Control` is browser-facing guidance; Tent itself decides on `X-Skip-Cache` alone. The
last row must never ship: the coverage spec fails first.

## Freshness

Tent's `CacheStalenessMiddleware` (`maxAgeSeconds => 10`) treats entries older than 10 seconds
as stale. A stale entry is **still served**, and a background refresh against the backend is
scheduled (stale-while-revalidate). There is no hard expiry.

The backend's `PUBLIC_MAX_AGE_SECONDS` (`backend/src/core/cache-class.ts`) mirrors this value
for the `public` `Cache-Control: max-age`. Change both together.

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

Today every bank and organization GET is `user-scoped` and never cached, so the observable effect
is limited to `public` GETs. The contract is in place for the per-user cache (see
[Future](#future)).

## Navi warm-up

Only `public` GET endpoints may be added to Navi's warm-up resources (`navi/resources/*.yml`).
`user-scoped` and `never` responses are never stored by Tent, so warming them is pointless, and
warming a user-scoped URL with a real session would be a data leak if it were ever cached.
Warm-up runs after tagged releases only. See [cache-warmer.md](../cache-warmer.md).

## Future

User-scoped responses stay uncached until Tent supports a per-user cache (see
[Flow](../flow.md#per-user-cache-upcoming)). At that point `user-scoped` routes may switch from
`X-Skip-Cache` to the per-user mechanism, and this page must be updated.
