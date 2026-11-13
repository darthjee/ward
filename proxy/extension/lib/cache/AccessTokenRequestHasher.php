<?php

namespace Tent\Cache;

use Tent\Models\RequestInterface;

/**
 * `RequestHasher` that keys the cache per caller, using the caller's
 * access-token cookie.
 *
 * - With a token: `sha256(token . '|' . query)`. Two callers asking for the
 *   same path and query get different entries, so a user-scoped response is
 *   only ever served back to the session that produced it.
 * - Without a token: `sha256(query)`, byte-identical to
 *   {@see QueryRequestHasher}, so anonymous entries stay shared.
 *
 * The raw token never appears in the key: it is only ever an input to
 * SHA-256, whose hex output is fixed-length and filesystem-safe.
 *
 * Expiry is deliberately **not** checked here; requests carrying an expired
 * or `exp`-less token are kept out of the cache by
 * {@see \Tent\Middlewares\ExpiredTokenCacheBypassMiddleware}, which runs
 * before the cache read. The token is read through
 * {@see AccessTokenCookie}, the same helper that middleware uses, so the two
 * always agree on which cookie identifies the caller.
 *
 * Configuration (in a `default_proxy` handler or `FileCacheMiddleware`):
 *
 * ```php
 * 'request_hasher' => [
 *     'class' => 'Tent\\Cache\\AccessTokenRequestHasher',
 *     // optional, defaults to 'access_token'
 *     'cookie' => 'access_token',
 * ],
 * ```
 */
class AccessTokenRequestHasher implements RequestHasher
{
    /**
     * @param string $cookieName Name of the cookie carrying the access token.
     */
    public function __construct(
        private string $cookieName = AccessTokenCookie::DEFAULT_COOKIE_NAME
    ) {
    }

    /**
     * Builds an AccessTokenRequestHasher from its configuration.
     *
     * Accepts an optional `cookie` (or `cookieName`) option naming the
     * access-token cookie; the `class` key Tent passes along is ignored.
     *
     * @param array $params The hasher configuration.
     * @return self The constructed hasher.
     */
    public static function build(array $params): self
    {
        $cookieName = $params['cookie']
            ?? $params['cookieName']
            ?? AccessTokenCookie::DEFAULT_COOKIE_NAME;

        return new self($cookieName);
    }

    /**
     * Computes the per-caller cache-key hash for the request.
     *
     * @param RequestInterface $request The request to derive the hash from.
     * @return string `sha256(token . '|' . query)` when the request carries
     *                the access-token cookie, `sha256(query)` otherwise.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) AccessTokenCookie is a pure,
     *     stateless static helper.
     */
    public function hash(RequestInterface $request): string
    {
        $token = AccessTokenCookie::token($request, $this->cookieName);

        if ($token === null) {
            return hash('sha256', $request->query());
        }

        return hash('sha256', $token . '|' . $request->query());
    }
}
