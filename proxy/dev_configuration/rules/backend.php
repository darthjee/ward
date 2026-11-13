<?php

/**
 * Backend routing rules.
 * Forwards all .json requests to the NestJS backend.
 *
 * This rule is the opt-out API cache: every 2xx .json response is
 * shared-cached by Tent unless it carries the X-Skip-Cache header.
 * Routes opt out through the backend's @CachePolicy() decorator, which
 * sets X-Skip-Cache for user-scoped/never classes and for any method
 * other than GET/HEAD.
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
        'additional_excluded_headers' => ['X-Cache-Invalidate']
    ],
    'matchers' => [
        ['uri' => '.json', 'type' => 'ends_with']
    ],
    'prependMiddlewares' => [
        [
            'class'    => 'Tent\\Middlewares\\CacheInvalidationMiddleware',
            'location' => $cacheFolder
        ]
    ],
    'middlewares' => [
        [
            'class' => 'Tent\\Middlewares\\SetClientIpMiddleware'
        ],
        [
            'class' => 'Tent\\Middlewares\\CacheStalenessMiddleware',
            'location' => $cacheFolder,
            'host' => 'http://backend:8080',
            'maxAgeSeconds' => 10
        ]
    ]
]);
