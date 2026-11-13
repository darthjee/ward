# Flow

## Status

The login flow is implemented. Each domain module adds its own data flow to its page under
`modules/` as it lands; this page keeps the generic request path every module shares.

## Overview

The backend (NestJS) owns account/login state and every module's persisted data; the frontend
(React/Vite) is served alongside it through the Tent proxy (see
[Architecture](architecture.md)). Tent forwards only `*.json` URLs to the backend; every other
URL is the frontend.

## Step by step

1. **Login.** The user logs into Ward (a lightweight, backend-owned account): username/
   password, verified against a bcrypt digest, backed by a JWT `access_token` cookie and a
   rotating refresh token (see `docs/agents/modules/auth.md`). The frontend's route-independent
   login modal (`LoginModal`) is the single entry point for this — Password/Register/Recover
   modes, plus a device-authorization mode: the user can instead ask an already-logged-in device
   to vouch for their username, and poll until that device approves or denies the request.

2. **Opening a module.** The frontend's hash router renders the module's page
   (`components/resources/<area>/pages/`), whose controller calls the module's HTTP client
   (`client/<Name>Client.js`, built on `ApiClient`).

3. **Request through Tent.** The client calls `/<module>/....json`. Tent either answers from
   its cache (cacheable `GET`s — see [API Caching](architecture/caching.md)) or forwards the
   request to the backend. If the Render service is asleep, the forwarded request wakes it
   (cold start); cached responses and the static frontend keep being served meanwhile.

4. **Backend.** Global guards run first (`OriginGuard` for CSRF, `JwtGuard` for the
   `access_token` cookie and active session, `AdminGuard` where marked). For a lazy module, the
   controller loads the module on its first request through `LazyModuleLoaderService`; later
   requests reuse it. The module's service reads/writes **only its own tables**, scoped to the
   current user, and may emit `<entity>.<action>` events for other modules. A successful write
   also declares the cached paths it changes in an `X-Cache-Invalidate` header. Tent clears
   those paths before answering, and never passes the header on. See
   [API Caching](architecture/caching.md#invalidation).

5. **Session renewal.** When the access token expires, `ApiClient` refreshes it with the
   rotating refresh token and retries; if that fails, the login modal opens again.

Per-module flows (e.g. paying a bill, logging a refuel) live in each module's page.

## Per-user cache (upcoming)

User-scoped read paths must bypass Tent's shared HTTP cache: they are declared
`@CachePolicy(CacheClass.UserScoped)`, which sends `X-Skip-Cache` (see
[API Caching](architecture/caching.md) and
[Cache Warmer](cache-warmer.md#per-user-cache-upcoming)). A per-user cache layer is in active
development on Tent itself and is expected to take over these read paths once available —
update this section and `cache-warmer.md` together once that lands.

## Open questions

_None recorded yet._
