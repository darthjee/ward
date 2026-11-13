# Plan: Cache invalidation on writes, including cross-path effects

Issue: [61-cache-invalidation-on-writes-including-cross-path-effects.md](../../issues/61-cache-invalidation-on-writes-including-cross-path-effects.md)

## Overview

Each successful write declares the cached GET paths it changes through a response header,
`X-Cache-Invalidate`. A new Ward proxy middleware reads that header after the upstream call and,
only on a 2xx response, recursively clears those path subtrees in the Tent cache. It always strips
the header before the response is stored or sent. Tent's `CacheCleanupMiddleware` is removed from
the backend rule.

On the backend, each non-GET route declares its invalidation with metadata:

- owner-scoped bank writes default to the owner's bank prefix;
- organization writes declare `/orgs.json` (plus `/orgs/:id.json` for a rename);
- auth, authorization-request and admin writes declare "none".

The coverage spec enforces that every write route has a declaration.

Today every bank and org GET is `user-scoped`, so it already carries `X-Skip-Cache` and is never
cached. This issue therefore establishes the contract and machinery that #60 (the per-user cache)
relies on. Its observable effect today is limited to any `public` GETs.

## Agents involved

- [backend](backend.md)
- [proxy](proxy.md)

The two can run in parallel because the header contract below is fixed. The architect then updates
the docs (see "Docs (architect)" below). After that, `security` and `cache` review the result.

## Shared contracts

### Response header `X-Cache-Invalidate`

- **Name:** `X-Cache-Invalidate`. Match it case-insensitively, as for any HTTP header.
- **Value:** a comma-separated list of absolute URL paths, with optional whitespace around the
  commas. For example: `X-Cache-Invalidate: /orgs.json, /orgs/3.json`.
- **Each path must:**
  - start with `/`;
  - contain no query (`?`), fragment (`#`), scheme (`://`), backslash, NUL or percent-encoding;
  - have no empty, `.` or `..` segment;
  - not be `/` itself.
- **Proxy handling of invalid paths:** an invalid entry is ignored, and the other entries are
  still honoured.
- **Semantics:** a recursive clear of the subtree. Every cached entry whose request path equals the
  given path or lies under it as a path-segment prefix is removed. That covers every query variant
  and every per-caller entry, for every method directory.
  - `/bank` clears `{loc}/bank/**`.
  - `/bank` does **not** clear `{loc}/bank.json/**`, and `/orgs/3/bank` does not clear
    `/orgs/4/...`.
- **When the backend emits it:** only on a successful response. Set it in an rxjs `tap` after the
  handler returns, so a thrown exception (4xx/5xx) never carries it.
- **When the proxy honours it:** only when `Response::isSuccessful()` (status 200–299) and the
  request method is not GET or HEAD. The proxy **always** strips the header, whatever the status or
  method.
- **Owner prefixes the backend emits:**
  - a personal bank write emits `/bank`;
  - an organization bank write emits `/orgs/<organizationId>/bank`, using the numeric id from
    `request.ownerContext` rather than the raw param;
  - a write never emits the other owner's prefix.
- **Organization writes:**
  - `POST /orgs.json` emits `/orgs.json`;
  - `PATCH /orgs/:orgId.json` emits `/orgs.json, /orgs/<orgId>.json`.
  - The backend must **never** emit `/orgs`. Because the clear is recursive, that would wipe every
    organization's tree.
- **No-invalidation writes:** auth, authorization-request and admin writes emit no header at all.

### Cache location

The proxy middleware and Tent's `FileCacheMiddleware` must use the same folder. The backend rule
sets the handler's `'cache' => $cacheFolder` explicitly, and the middleware receives
`'location' => $cacheFolder`.

## Docs (architect)

The architect updates these after both agents finish. They are outside both specialists' scopes.

- `docs/agents/architecture/caching.md` § Invalidation:
  - describe the header model: the backend declares it, and the proxy clears after a 2xx,
    recursively, and strips the header;
  - describe the owner-subtree granularity and its accepted cost: one personal write clears every
    user's `/bank` entries;
  - describe the accepted race windows: the in-flight GET miss and `BackgroundRefresher`, healing
    in about 10 s plus one read;
  - state the rule for out-of-band writers: purge the cache or keep the data uncached, and no purge
    endpoint is built now;
  - note that `CacheCleanupMiddleware` was removed.
- `docs/agents/architecture/proxy.md`:
  - "Custom extension code" lists `CacheInvalidationMiddleware`;
  - "Cache bypass" replaces the `CacheCleanupMiddleware` bullet;
  - note the `prependMiddlewares` placement and the reason for it.
- `docs/agents/flow.md`: add a short note on write → invalidation, linked to `caching.md`.
- `.claude/agents/cache.md` and `.github/agents/cache.agent.md`, "Cache-class review": add the rule
  "every non-GET route declares invalidation (owner-scoped default, explicit paths, or none); flag
  any decorator emitting `/orgs` or `/`".
- `docs/agents/backend/` and `docs/agents/architecture/backend.md`: mention the new decorator
  next to `@CachePolicy`, if they list the core decorators.

## Reviews

- `security`:
  - the proxy middleware (path validation, confinement to the cache location, symlinks, header
    stripping);
  - the rule changes;
  - the backend emission (no user-controlled data in the paths beyond the parsed numeric ids).
- `cache`: every write declares invalidation, and the `X-Skip-Cache` behaviour is unchanged.
