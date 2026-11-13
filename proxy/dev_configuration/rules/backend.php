<?php

/**
 * Backend routing rules.
 * Forwards all .json requests to the NestJS backend.
 *
 * This rule is the opt-in, per-caller API cache: a 2xx .json response is
 * cached by Tent only when it carries X-Cache-Allow (require_cache_header)
 * and does not carry X-Skip-Cache (skip_cache_header, which still wins).
 * The backend's @CachePolicy() decorator sets X-Cache-Allow for
 * public/user-scoped GET/HEAD, and X-Skip-Cache for the never class and
 * for any method other than GET/HEAD. Nothing is cached by default.
 *
 * The cache key comes from AccessTokenRequestHasher:
 * sha256(access_token . '|' . query) when the access_token cookie is
 * present, so every caller gets their own entries, and sha256(query)
 * otherwise, so anonymous entries stay shared. The raw token never
 * appears in the key.
 *
 * ExpiredTokenCacheBypassMiddleware marks requests carrying an expired or
 * exp-less access token with the request header X-Skip-Cache, so they are
 * neither served from nor stored in the cache (and never trigger a
 * background refresh). It must sit in prependMiddlewares: only those run
 * before the handler's FileCacheMiddleware reads the cache; anything in
 * middlewares runs after it.
 *
 * filter_query_params is deliberately unset. If it is ever added, it must
 * never drop a scope-defining param (for example an org id): the query is
 * part of the cache key, and dropping such a param would let one scope's
 * cached response be served for another.
 *
 * Authorization is excluded from stored headers (handler and
 * CacheStalenessMiddleware) as defense in depth; Tent only stores response
 * headers.
 *
 * Invalidation is header-driven: a successful write declares the cached
 * paths it changes through X-Cache-Invalidate, and
 * CacheInvalidationMiddleware recursively clears those subtrees in
 * $cacheFolder after a 2xx non-GET/HEAD response. It always strips the
 * header, and is registered under prependMiddlewares so its
 * processResponse runs before the handler's FileCacheMiddleware could
 * store the header; additional_excluded_headers is a second layer.
 *
 * CacheStalenessMiddleware's maxAgeSeconds must stay in sync with the
 * backend's PUBLIC_MAX_AGE_SECONDS (backend/src/core/cache-class.ts);
 * change both together.
 *
 * Full strategy: docs/agents/architecture/caching.md
 */

use Tent\Configuration;

Configuration::buildRule([
    'handler' => [
        'type' => 'default_proxy',
        'host' => 'http://backend:8080',
        'cache' => $cacheFolder,
        'skip_cache_header' => 'X-Skip-Cache',
        'require_cache_header' => 'X-Cache-Allow',
        // AccessTokenRequestHasher and ExpiredTokenCacheBypassMiddleware both
        // read the `access_token` cookie by default; their cookie names must
        // always match, otherwise the expiry check would look at a different
        // cookie than the one the cache key is built from.
        'request_hasher' => [
            'class' => 'Tent\\Cache\\AccessTokenRequestHasher'
        ],
        // filter_query_params stays unset; if ever added, it must never drop
        // a scope-defining param (e.g. an org id), as the query is part of
        // the cache key.
        'additional_excluded_headers' => ['X-Cache-Invalidate', 'Authorization']
    ],
    'matchers' => [
        ['uri' => '.json', 'type' => 'ends_with']
    ],
    'prependMiddlewares' => [
        [
            'class'    => 'Tent\\Middlewares\\CacheInvalidationMiddleware',
            'location' => $cacheFolder
        ],
        // Reads the `access_token` cookie by default; its cookie name must
        // always match AccessTokenRequestHasher's (see request_hasher above),
        // otherwise the expiry check would look at a different cookie than
        // the cache key.
        [
            'class' => 'Tent\\Middlewares\\ExpiredTokenCacheBypassMiddleware'
        ]
    ],
    'middlewares' => [
        [
            'class' => 'Tent\\Middlewares\\SetClientIpMiddleware'
        ],
        // CacheStalenessMiddleware runs after the handler's
        // FileCacheMiddleware, which sets the response on every cache hit and
        // stops the remaining request middlewares. Its processRequest
        // therefore never runs today: maxAgeSeconds is not enforced and
        // BackgroundRefresher never fires. Do NOT move it before the handler
        // (e.g. into prependMiddlewares) until Tent's refresher honours
        // require_cache_header/skip_cache_header: the refresher stores any
        // 2xx, so per-user entries could be refreshed/stored without opting
        // in. Re-review security before making that change.
        [
            'class' => 'Tent\\Middlewares\\CacheStalenessMiddleware',
            'location' => $cacheFolder,
            'host' => 'http://backend:8080',
            'maxAgeSeconds' => 10,
            'additional_excluded_headers' => ['Authorization']
        ]
    ]
]);
