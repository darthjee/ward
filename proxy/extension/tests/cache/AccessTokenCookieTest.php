<?php

namespace Tent\Cache\Tests;

use PHPUnit\Framework\TestCase;
use Tent\Cache\AccessTokenCookie;
use Tent\Models\ProcessingRequest;

/**
 * Unit tests for AccessTokenCookie.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 *
 * @SuppressWarnings(PHPMD.StaticAccess) AccessTokenCookie is a pure,
 *     stateless static helper (see the class's own docblock).
 */
class AccessTokenCookieTest extends TestCase
{
    private const NOW = 1700000000;

    /**
     * Builds a request carrying the given headers.
     */
    private function makeRequest(array $headers): ProcessingRequest
    {
        return new ProcessingRequest(['headers' => $headers, 'query' => '']);
    }

    /**
     * base64url-encodes the given string, without padding.
     */
    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    /**
     * Builds an (unsigned-in-practice) JWT carrying the given claims.
     */
    private function makeToken(array $claims): string
    {
        return $this->base64Url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']))
            . '.' . $this->base64Url(json_encode($claims))
            . '.' . $this->base64Url('signature');
    }

    public function testTokenIsFoundAmongSeveralCookies(): void
    {
        $request = $this->makeRequest([
            'Cookie' => 'theme=dark; access_token=abc.def.ghi; refresh_token=xyz',
        ]);

        $this->assertSame('abc.def.ghi', AccessTokenCookie::token($request));
    }

    public function testTokenIsUrlDecoded(): void
    {
        $request = $this->makeRequest(['Cookie' => 'access_token=a%3Db']);

        $this->assertSame('a=b', AccessTokenCookie::token($request));
    }

    public function testTokenKeepsEqualsSignsAfterTheFirst(): void
    {
        $request = $this->makeRequest(['Cookie' => 'access_token=a=b']);

        $this->assertSame('a=b', AccessTokenCookie::token($request));
    }

    public function testTokenIsReadFromLowerCaseCookieHeader(): void
    {
        $request = $this->makeRequest(['cookie' => 'access_token=abc.def.ghi']);

        $this->assertSame('abc.def.ghi', AccessTokenCookie::token($request));
    }

    public function testTokenUsesCustomCookieName(): void
    {
        $request = $this->makeRequest(['Cookie' => 'access_token=one; other_token=two']);

        $this->assertSame('two', AccessTokenCookie::token($request, 'other_token'));
    }

    public function testTokenIsNullWithoutCookieHeader(): void
    {
        $request = $this->makeRequest(['Host' => 'ward.example.com']);

        $this->assertNull(AccessTokenCookie::token($request));
    }

    public function testTokenIsNullWithoutAccessTokenCookie(): void
    {
        $request = $this->makeRequest(['Cookie' => 'theme=dark; refresh_token=xyz']);

        $this->assertNull(AccessTokenCookie::token($request));
    }

    public function testTokenIsNullForSimilarlyNamedCookie(): void
    {
        $request = $this->makeRequest(['Cookie' => 'my_access_token=abc']);

        $this->assertNull(AccessTokenCookie::token($request));
    }

    public function testTokenIsNullForEmptyValue(): void
    {
        $request = $this->makeRequest(['Cookie' => 'access_token=; theme=dark']);

        $this->assertNull(AccessTokenCookie::token($request));
    }

    public function testExpiresAtReturnsExp(): void
    {
        $token = $this->makeToken(['sub' => 1, 'exp' => self::NOW + 900]);

        $this->assertSame(self::NOW + 900, AccessTokenCookie::expiresAt($token));
    }

    public function testExpiresAtAcceptsNumericStringExp(): void
    {
        $token = $this->makeToken(['exp' => (string) (self::NOW + 900)]);

        $this->assertSame(self::NOW + 900, AccessTokenCookie::expiresAt($token));
    }

    public function testExpiresAtIsNullWithoutExp(): void
    {
        $token = $this->makeToken(['sub' => 1]);

        $this->assertNull(AccessTokenCookie::expiresAt($token));
    }

    public function testExpiresAtIsNullForNonNumericExp(): void
    {
        $token = $this->makeToken(['exp' => 'tomorrow']);

        $this->assertNull(AccessTokenCookie::expiresAt($token));
    }

    public function testExpiresAtIsNullForWrongSegmentCount(): void
    {
        $this->assertNull(AccessTokenCookie::expiresAt('only.two'));
        $this->assertNull(AccessTokenCookie::expiresAt('a.b.c.d'));
        $this->assertNull(AccessTokenCookie::expiresAt('opaque-token'));
    }

    public function testExpiresAtIsNullForBadBase64(): void
    {
        $this->assertNull(AccessTokenCookie::expiresAt('header.!!!*.signature'));
        $this->assertNull(AccessTokenCookie::expiresAt('header.abcde.signature'));
    }

    public function testExpiresAtIsNullForNonJsonPayload(): void
    {
        $token = 'header.' . $this->base64Url('not json') . '.signature';

        $this->assertNull(AccessTokenCookie::expiresAt($token));
    }

    public function testExpiresAtIsNullForScalarJsonPayload(): void
    {
        $token = 'header.' . $this->base64Url('42') . '.signature';

        $this->assertNull(AccessTokenCookie::expiresAt($token));
    }

    public function testIsUsableForFutureExp(): void
    {
        $token = $this->makeToken(['exp' => self::NOW + 1]);

        $this->assertTrue(AccessTokenCookie::isUsable($token, self::NOW));
    }

    public function testIsNotUsableForPastExp(): void
    {
        $token = $this->makeToken(['exp' => self::NOW - 1]);

        $this->assertFalse(AccessTokenCookie::isUsable($token, self::NOW));
    }

    public function testIsNotUsableWhenExpEqualsNow(): void
    {
        $token = $this->makeToken(['exp' => self::NOW]);

        $this->assertFalse(AccessTokenCookie::isUsable($token, self::NOW));
    }

    public function testIsNotUsableWithoutExp(): void
    {
        $token = $this->makeToken(['sub' => 1]);

        $this->assertFalse(AccessTokenCookie::isUsable($token, self::NOW));
    }

    public function testIsNotUsableForMalformedToken(): void
    {
        $this->assertFalse(AccessTokenCookie::isUsable('garbage', self::NOW));
    }

    public function testIsUsableDefaultsToCurrentTime(): void
    {
        $this->assertTrue(AccessTokenCookie::isUsable($this->makeToken(['exp' => time() + 600])));
        $this->assertFalse(AccessTokenCookie::isUsable($this->makeToken(['exp' => time() - 600])));
    }
}
