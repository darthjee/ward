<?php

namespace Tent\Middlewares;

use Tent\Cache\AccessTokenCookie;
use Tent\Models\ProcessingRequest;

/**
 * Keeps requests that carry an expired (or `exp`-less) access token out of
 * the Tent cache, by marking them with the request-side skip-cache header
 * (`X-Skip-Cache: 1` by default).
 *
 * ## Why this exists
 *
 * The backend rule keys its cache per caller with
 * {@see \Tent\Cache\AccessTokenRequestHasher} (`sha256(token . '|' . query)`).
 * Once a token has expired, the backend would answer `401` for it, so any
 * entry stored under that token's key must no longer be served: doing so
 * would extend a session past its expiry, up to the cache's lifetime. The
 * hasher itself does not look at expiry; this middleware does, through the
 * same {@see AccessTokenCookie} helper, so both agree on the token.
 *
 * - No token: the request is left unchanged; the anonymous, shared
 *   `sha256(query)` key applies.
 * - A token whose `exp` is readable and in the future: left unchanged; the
 *   per-caller key applies.
 * - A token that is expired, has no readable `exp`, or is malformed: the
 *   skip-cache header is set on the request. The cookie itself is **not**
 *   stripped: that would fall back to the shared anonymous key and break
 *   the backend's 401/refresh flow. The JWT signature is never checked.
 *
 * ## How the header bypasses the cache
 *
 * - `FileCacheMiddleware::processRequest()` skips the cache **read** when
 *   the request carries its configured `skip_cache_header`.
 * - `FileCacheMiddleware::processResponse()` skips the cache **write** too,
 *   because `$response->request()` is this same mutated `ProcessingRequest`
 *   and still carries the header.
 * - With no cache hit, `CacheStalenessMiddleware` never schedules a
 *   background refresh, so an expired token can never trigger one.
 *
 * The header name must match the handler's `skip_cache_header`. The backend
 * ignores it on requests.
 *
 * ## Why it must be in `prependMiddlewares`
 *
 * Tent's `RequestHandler::build()` adds the handler's own middlewares first
 * (for `default_proxy`, including `FileCacheMiddleware`), then the rule's
 * `prependMiddlewares` in front of them, then the rule's `middlewares` after
 * them. Only `prependMiddlewares` run **before** the cache read; placed in
 * `middlewares`, this would run after a cached response was already served.
 *
 * ## Usage in configuration
 *
 * ```php
 * Configuration::buildRule([
 *     'handler' => [
 *         'type' => 'default_proxy',
 *         'skip_cache_header' => 'X-Skip-Cache',
 *         'request_hasher' => ['class' => 'Tent\\Cache\\AccessTokenRequestHasher'],
 *         ...
 *     ],
 *     'matchers' => [...],
 *     'prependMiddlewares' => [
 *         [
 *             'class' => 'Tent\\Middlewares\\ExpiredTokenCacheBypassMiddleware',
 *             // optional, defaults shown
 *             'skip_cache_header' => 'X-Skip-Cache',
 *             'cookie' => 'access_token',
 *         ],
 *     ],
 * ]);
 * ```
 */
class ExpiredTokenCacheBypassMiddleware extends Middleware
{
    public const DEFAULT_SKIP_CACHE_HEADER = 'X-Skip-Cache';

    /**
     * @param string        $skipCacheHeader Request header set to bypass the
     *                                       cache; must match the handler's
     *                                       `skip_cache_header`.
     * @param string        $cookieName      Name of the access-token cookie.
     * @param callable|null $clock           Returns the current Unix
     *                                       timestamp; defaults to `time()`.
     */
    public function __construct(
        private string $skipCacheHeader = self::DEFAULT_SKIP_CACHE_HEADER,
        private string $cookieName = AccessTokenCookie::DEFAULT_COOKIE_NAME,
        private $clock = null
    ) {
    }

    /**
     * Builds an ExpiredTokenCacheBypassMiddleware from its configuration.
     *
     * Accepts `skipCacheHeader` / `skip_cache_header` and `cookie` /
     * `cookieName`; the `class` key Tent passes along is ignored.
     *
     * @param array $attributes The middleware configuration.
     * @return ExpiredTokenCacheBypassMiddleware The constructed middleware.
     */
    public static function build(array $attributes): ExpiredTokenCacheBypassMiddleware
    {
        return new self(
            $attributes['skipCacheHeader']
                ?? $attributes['skip_cache_header']
                ?? self::DEFAULT_SKIP_CACHE_HEADER,
            $attributes['cookie']
                ?? $attributes['cookieName']
                ?? AccessTokenCookie::DEFAULT_COOKIE_NAME
        );
    }

    /**
     * Sets the skip-cache header when the request carries an access token
     * that is not usable (expired, `exp`-less or malformed). Never sets a
     * response, so the chain always continues.
     *
     * @param ProcessingRequest $request The request to process.
     * @return ProcessingRequest The (possibly marked) request.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) AccessTokenCookie is a pure,
     *     stateless static helper.
     */
    public function processRequest(ProcessingRequest $request): ProcessingRequest
    {
        $token = AccessTokenCookie::token($request, $this->cookieName);

        if ($token === null) {
            return $request;
        }

        $now = $this->clock === null ? time() : (int) ($this->clock)();

        if (!AccessTokenCookie::isUsable($token, $now)) {
            $request->setHeader($this->skipCacheHeader, '1');
        }

        return $request;
    }
}
