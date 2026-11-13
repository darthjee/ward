<?php

namespace Tent\Cache\Tests;

use PHPUnit\Framework\TestCase;
use Tent\Cache\AccessTokenRequestHasher;
use Tent\Cache\QueryRequestHasher;
use Tent\Models\ProcessingRequest;

/**
 * Unit tests for AccessTokenRequestHasher.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 *
 * @SuppressWarnings(PHPMD.StaticAccess) build() is the factory Tent itself
 *     calls to construct hashers.
 */
class AccessTokenRequestHasherTest extends TestCase
{
    private const TOKEN_A = 'aaa.bbb.ccc';
    private const TOKEN_B = 'ddd.eee.fff';

    /**
     * Builds a request with the given query and, optionally, cookie header.
     */
    private function makeRequest(string $query, ?string $cookie = null): ProcessingRequest
    {
        $headers = ['Host' => 'ward.example.com'];

        if ($cookie !== null) {
            $headers['Cookie'] = $cookie;
        }

        return new ProcessingRequest(['headers' => $headers, 'query' => $query]);
    }

    public function testSameTokenAndQueryGiveSameKey(): void
    {
        $hasher = AccessTokenRequestHasher::build([]);

        $first = $hasher->hash($this->makeRequest('page=1', 'access_token=' . self::TOKEN_A));
        $second = $hasher->hash($this->makeRequest('page=1', 'access_token=' . self::TOKEN_A));

        $this->assertSame($first, $second);
    }

    public function testDifferentTokensWithSameQueryGiveDifferentKeys(): void
    {
        $hasher = AccessTokenRequestHasher::build([]);

        $first = $hasher->hash($this->makeRequest('page=1', 'access_token=' . self::TOKEN_A));
        $second = $hasher->hash($this->makeRequest('page=1', 'access_token=' . self::TOKEN_B));

        $this->assertNotSame($first, $second);
    }

    public function testSameTokenWithDifferentQueriesGivesDifferentKeys(): void
    {
        $hasher = AccessTokenRequestHasher::build([]);

        $first = $hasher->hash($this->makeRequest('page=1', 'access_token=' . self::TOKEN_A));
        $second = $hasher->hash($this->makeRequest('page=2', 'access_token=' . self::TOKEN_A));

        $this->assertNotSame($first, $second);
    }

    public function testKeyWithTokenIsHashOfTokenAndQuery(): void
    {
        $hasher = AccessTokenRequestHasher::build([]);

        $key = $hasher->hash($this->makeRequest('page=1', 'access_token=' . self::TOKEN_A));

        $this->assertSame(hash('sha256', self::TOKEN_A . '|page=1'), $key);
    }

    public function testNoTokenGivesPlainQueryHash(): void
    {
        $hasher = AccessTokenRequestHasher::build([]);
        $request = $this->makeRequest('page=1', 'theme=dark');

        $key = $hasher->hash($request);

        $this->assertSame(hash('sha256', 'page=1'), $key);
        $this->assertSame((new QueryRequestHasher())->hash($request), $key);
    }

    public function testNoCookieHeaderGivesPlainQueryHash(): void
    {
        $hasher = AccessTokenRequestHasher::build([]);
        $request = $this->makeRequest('page=1');

        $this->assertSame((new QueryRequestHasher())->hash($request), $hasher->hash($request));
    }

    public function testRawTokenIsNotPartOfTheKey(): void
    {
        $hasher = AccessTokenRequestHasher::build([]);

        $key = $hasher->hash($this->makeRequest('page=1', 'access_token=' . self::TOKEN_A));

        $this->assertStringNotContainsString(self::TOKEN_A, $key);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $key);
    }

    public function testBuildIgnoresClassKeyAndHonoursCustomCookie(): void
    {
        $hasher = AccessTokenRequestHasher::build([
            'class' => AccessTokenRequestHasher::class,
            'cookie' => 'other',
        ]);
        $request = $this->makeRequest('page=1', 'access_token=' . self::TOKEN_A . '; other=' . self::TOKEN_B);

        $this->assertSame(hash('sha256', self::TOKEN_B . '|page=1'), $hasher->hash($request));
    }

    public function testBuildAcceptsCookieNameOption(): void
    {
        $hasher = AccessTokenRequestHasher::build(['cookieName' => 'other']);
        $request = $this->makeRequest('page=1', 'other=' . self::TOKEN_B);

        $this->assertSame(hash('sha256', self::TOKEN_B . '|page=1'), $hasher->hash($request));
    }

    public function testCustomCookieIgnoresDefaultCookie(): void
    {
        $hasher = AccessTokenRequestHasher::build(['cookie' => 'other']);
        $request = $this->makeRequest('page=1', 'access_token=' . self::TOKEN_A);

        $this->assertSame(hash('sha256', 'page=1'), $hasher->hash($request));
    }
}
