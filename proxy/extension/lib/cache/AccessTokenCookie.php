<?php

namespace Tent\Cache;

use Tent\Models\RequestInterface;

/**
 * Standalone static helper that reads the caller's `access_token` cookie
 * from a request and inspects the `exp` claim of the JWT it carries.
 *
 * It is the single source of truth for "which token does this request
 * carry, and is it still usable", shared by
 * {@see \Tent\Cache\AccessTokenRequestHasher} (which keys the cache per
 * token) and {@see \Tent\Middlewares\ExpiredTokenCacheBypassMiddleware}
 * (which bypasses the cache for expired or `exp`-less tokens), so the two
 * can never disagree about which cookie or claim they look at.
 *
 * The cookie is read from the raw `Cookie` request header, located
 * case-insensitively. Pairs are split on `;`, trimmed, and split on the
 * first `=`; the value is URL-decoded. A missing header, a missing cookie
 * and an empty value all yield `null`.
 *
 * **The JWT signature is never checked.** Only the payload segment is
 * base64url-decoded to read `exp`; the proxy never holds (or needs) the JWT
 * secret. This is safe for its uses here: the token only ever feeds a cache
 * key (a forged token hashes to its own key, which only the forger holds,
 * and the backend still rejects it on a miss) and the decision to bypass the
 * cache (bypassing is always the safe side). The backend remains the only
 * authority that validates tokens.
 *
 * None of the methods throw: any malformed input (wrong segment count, bad
 * base64, non-JSON payload, non-numeric `exp`) is reported as `null`/`false`.
 */
class AccessTokenCookie
{
    /**
     * Default name of the cookie carrying the access token.
     */
    public const DEFAULT_COOKIE_NAME = 'access_token';

    /**
     * Returns the value of the access-token cookie carried by the request.
     *
     * @param RequestInterface $request    The request to read the cookie from.
     * @param string           $cookieName The cookie name to look for.
     * @return string|null The URL-decoded cookie value, or null when the
     *                     `Cookie` header or the cookie is missing, or the
     *                     value is empty.
     */
    public static function token(
        RequestInterface $request,
        string $cookieName = self::DEFAULT_COOKIE_NAME
    ): ?string {
        $header = self::cookieHeader($request);

        if ($header === null) {
            return null;
        }

        foreach (explode(';', $header) as $pair) {
            $parts = explode('=', trim($pair), 2);

            if (count($parts) !== 2 || trim($parts[0]) !== $cookieName) {
                continue;
            }

            $value = urldecode(trim($parts[1]));

            return $value === '' ? null : $value;
        }

        return null;
    }

    /**
     * Returns the `exp` claim of the given JWT, without checking its
     * signature.
     *
     * @param string $token The JWT (`header.payload.signature`).
     * @return integer|null The `exp` claim as a Unix timestamp, or null when
     *                      the token is malformed or `exp` is missing or not
     *                      numeric.
     */
    public static function expiresAt(string $token): ?int
    {
        $segments = explode('.', $token);

        if (count($segments) !== 3) {
            return null;
        }

        $payload = self::base64UrlDecode($segments[1]);

        if ($payload === null) {
            return null;
        }

        $claims = json_decode($payload, true);

        if (!is_array($claims) || !array_key_exists('exp', $claims)) {
            return null;
        }

        $exp = $claims['exp'];

        if (is_int($exp)) {
            return $exp;
        }

        if (is_float($exp) || (is_string($exp) && is_numeric($exp))) {
            return (int) $exp;
        }

        return null;
    }

    /**
     * Tells whether the token carries a readable `exp` that is still in the
     * future.
     *
     * @param string       $token The JWT to inspect.
     * @param integer|null $now   The current Unix timestamp; defaults to
     *                            `time()`.
     * @return boolean True when `exp` is readable and greater than `$now`.
     */
    public static function isUsable(string $token, ?int $now = null): bool
    {
        $exp = self::expiresAt($token);

        return $exp !== null && $exp > ($now ?? time());
    }

    /**
     * Finds the `Cookie` request header, case-insensitively.
     *
     * @param RequestInterface $request The request to read the header from.
     * @return string|null The header value, or null when absent.
     */
    private static function cookieHeader(RequestInterface $request): ?string
    {
        foreach ($request->headers() as $name => $value) {
            if (strtolower((string) $name) !== 'cookie') {
                continue;
            }

            if (is_array($value)) {
                $value = implode('; ', $value);
            }

            return is_string($value) ? $value : null;
        }

        return null;
    }

    /**
     * Decodes a base64url segment (no padding required).
     *
     * @param string $segment The base64url-encoded segment.
     * @return string|null The decoded bytes, or null when the segment is not
     *                     valid base64url.
     */
    private static function base64UrlDecode(string $segment): ?string
    {
        $base64 = strtr($segment, '-_', '+/');
        $padding = strlen($base64) % 4;

        if ($padding === 1) {
            return null;
        }

        if ($padding > 0) {
            $base64 .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode($base64, true);

        return $decoded === false ? null : $decoded;
    }
}
