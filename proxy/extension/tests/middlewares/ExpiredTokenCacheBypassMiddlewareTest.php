<?php

namespace Tent\Middlewares\Tests;

use FilesystemIterator;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Tent\Cache\AccessTokenRequestHasher;
use Tent\Content\FileCache;
use Tent\Middlewares\ExpiredTokenCacheBypassMiddleware;
use Tent\Middlewares\FileCacheMiddleware;
use Tent\Models\FolderLocation;
use Tent\Models\ProcessingRequest;
use Tent\Models\Response;

/**
 * Unit tests for ExpiredTokenCacheBypassMiddleware, plus integration-style
 * tests against a real FileCacheMiddleware backed by a temporary folder.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 *
 * @SuppressWarnings(PHPMD.StaticAccess) build() is the factory Tent itself
 *     calls to construct middlewares and hashers.
 */
class ExpiredTokenCacheBypassMiddlewareTest extends TestCase
{
    private const NOW = 1700000000;

    /**
     * @var string Temporary cache location for the integration tests.
     */
    private string $location;

    protected function setUp(): void
    {
        $this->location = sys_get_temp_dir() . '/ward-token-cache-' . uniqid('', true);
        mkdir($this->location, 0777, true);
    }

    protected function tearDown(): void
    {
        if (!is_dir($this->location)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->location, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $entry) {
            if ($entry->isLink() || !$entry->isDir()) {
                unlink($entry->getPathname());
                continue;
            }

            rmdir($entry->getPathname());
        }

        rmdir($this->location);
    }

    /**
     * base64url-encodes the given string, without padding.
     */
    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    /**
     * Builds a JWT-shaped token carrying the given claims.
     */
    private function makeToken(array $claims): string
    {
        return $this->base64Url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']))
            . '.' . $this->base64Url(json_encode($claims))
            . '.' . $this->base64Url('signature');
    }

    /**
     * Builds a GET request carrying the given cookie header (if any).
     */
    private function makeRequest(?string $cookie = null): ProcessingRequest
    {
        $headers = ['Host' => 'ward.example.com'];

        if ($cookie !== null) {
            $headers['Cookie'] = $cookie;
        }

        return new ProcessingRequest([
            'requestMethod' => 'GET',
            'requestPath' => '/bank/accounts.json',
            'query' => 'page=1',
            'headers' => $headers,
        ]);
    }

    /**
     * Builds the middleware with a fixed clock.
     */
    private function makeMiddleware(
        string $header = 'X-Skip-Cache',
        string $cookie = 'access_token'
    ): ExpiredTokenCacheBypassMiddleware {
        return new ExpiredTokenCacheBypassMiddleware($header, $cookie, static fn(): int => self::NOW);
    }

    /**
     * Builds the real FileCacheMiddleware configured like the backend rule.
     */
    private function makeFileCache(): FileCacheMiddleware
    {
        return FileCacheMiddleware::build([
            'location' => $this->location,
            'skip_cache_header' => 'X-Skip-Cache',
            'require_cache_header' => 'X-Cache-Allow',
            'request_hasher' => ['class' => 'Tent\\Cache\\AccessTokenRequestHasher'],
        ]);
    }

    /**
     * Builds a cacheable 200 response for the given request.
     */
    private function makeResponse(ProcessingRequest $request, string $body = '{"ok":true}'): Response
    {
        return new Response([
            'httpCode' => 200,
            'body' => $body,
            'headers' => ['Content-Type: application/json', 'X-Cache-Allow: true'],
            'request' => $request,
        ]);
    }

    /**
     * Tells whether the cache holds an entry for a clean request with the
     * given cookie (computed without the bypass header).
     */
    private function cacheExists(string $cookie): bool
    {
        $cache = new FileCache(
            $this->makeRequest($cookie),
            new FolderLocation($this->location),
            AccessTokenRequestHasher::build([])
        );

        return $cache->exists();
    }

    /**
     * Stores an entry directly, under the key of a request with the given
     * cookie.
     */
    private function seedCache(string $cookie, string $body): void
    {
        $request = $this->makeRequest($cookie);
        $cache = new FileCache($request, new FolderLocation($this->location), AccessTokenRequestHasher::build([]));
        $cache->store($this->makeResponse($request, $body));
    }

    public function testExpiredTokenSetsSkipHeader(): void
    {
        $token = $this->makeToken(['exp' => self::NOW - 60]);

        $request = $this->makeMiddleware()->processRequest($this->makeRequest('access_token=' . $token));

        $this->assertSame('1', $request->headers()['X-Skip-Cache'] ?? null);
    }

    public function testTokenWithoutExpSetsSkipHeader(): void
    {
        $token = $this->makeToken(['sub' => 1]);

        $request = $this->makeMiddleware()->processRequest($this->makeRequest('access_token=' . $token));

        $this->assertSame('1', $request->headers()['X-Skip-Cache'] ?? null);
    }

    public function testMalformedTokenSetsSkipHeader(): void
    {
        $request = $this->makeMiddleware()->processRequest($this->makeRequest('access_token=not-a-jwt'));

        $this->assertSame('1', $request->headers()['X-Skip-Cache'] ?? null);
    }

    public function testValidTokenLeavesHeadersUnchanged(): void
    {
        $cookie = 'access_token=' . $this->makeToken(['exp' => self::NOW + 600]);
        $expected = $this->makeRequest($cookie)->headers();

        $request = $this->makeMiddleware()->processRequest($this->makeRequest($cookie));

        $this->assertSame($expected, $request->headers());
    }

    public function testNoCookieLeavesHeadersUnchanged(): void
    {
        $expected = $this->makeRequest('theme=dark')->headers();

        $request = $this->makeMiddleware()->processRequest($this->makeRequest('theme=dark'));

        $this->assertSame($expected, $request->headers());
    }

    public function testCustomHeaderAndCookieNamesAreHonoured(): void
    {
        $expired = $this->makeToken(['exp' => self::NOW - 60]);
        $valid = $this->makeToken(['exp' => self::NOW + 600]);
        $middleware = $this->makeMiddleware('X-Bypass', 'session');

        $request = $middleware->processRequest(
            $this->makeRequest('access_token=' . $valid . '; session=' . $expired)
        );

        $this->assertSame('1', $request->headers()['X-Bypass'] ?? null);
        $this->assertArrayNotHasKey('X-Skip-Cache', $request->headers());
    }

    public function testCustomCookieIgnoresDefaultCookie(): void
    {
        $expired = $this->makeToken(['exp' => self::NOW - 60]);
        $middleware = $this->makeMiddleware('X-Skip-Cache', 'session');

        $request = $middleware->processRequest($this->makeRequest('access_token=' . $expired));

        $this->assertArrayNotHasKey('X-Skip-Cache', $request->headers());
    }

    public function testBuildAcceptsSnakeAndCamelCaseOptions(): void
    {
        $expired = 'access_token=' . $this->makeToken(['exp' => time() - 60]);
        $sessionExpired = 'session=' . $this->makeToken(['exp' => time() - 60]);

        $snake = ExpiredTokenCacheBypassMiddleware::build([
            'class' => ExpiredTokenCacheBypassMiddleware::class,
            'skip_cache_header' => 'X-Snake',
            'cookieName' => 'session',
        ])->processRequest($this->makeRequest($sessionExpired));
        $camel = ExpiredTokenCacheBypassMiddleware::build([
            'skipCacheHeader' => 'X-Camel',
        ])->processRequest($this->makeRequest($expired));
        $default = ExpiredTokenCacheBypassMiddleware::build([])->processRequest($this->makeRequest($expired));

        $this->assertSame('1', $snake->headers()['X-Snake'] ?? null);
        $this->assertSame('1', $camel->headers()['X-Camel'] ?? null);
        $this->assertSame('1', $default->headers()['X-Skip-Cache'] ?? null);
    }

    public function testNeverSetsAResponse(): void
    {
        $middleware = $this->makeMiddleware();
        $cookies = [
            null,
            'access_token=' . $this->makeToken(['exp' => self::NOW - 60]),
            'access_token=' . $this->makeToken(['exp' => self::NOW + 600]),
            'access_token=garbage',
        ];

        foreach ($cookies as $cookie) {
            $this->assertFalse($middleware->processRequest($this->makeRequest($cookie))->hasResponse());
        }
    }

    public function testResponseIsPassedThrough(): void
    {
        $response = $this->makeResponse($this->makeRequest());

        $this->assertSame($response, $this->makeMiddleware()->processResponse($response));
    }

    public function testExpiredTokenIsNotServedFromExistingEntry(): void
    {
        $cookie = 'access_token=' . $this->makeToken(['exp' => self::NOW - 60]);
        $this->seedCache($cookie, '{"stale":true}');
        $this->assertTrue($this->cacheExists($cookie));

        $request = $this->makeMiddleware()->processRequest($this->makeRequest($cookie));
        $request = $this->makeFileCache()->processRequest($request);

        $this->assertFalse($request->hasResponse());
    }

    public function testExpiredTokenResponseIsNotStored(): void
    {
        $cookie = 'access_token=' . $this->makeToken(['exp' => self::NOW - 60]);
        $fileCache = $this->makeFileCache();

        $request = $this->makeMiddleware()->processRequest($this->makeRequest($cookie));
        $request = $fileCache->processRequest($request);
        $fileCache->processResponse($this->makeResponse($request));

        $this->assertFalse($this->cacheExists($cookie));
    }

    public function testValidTokenResponseIsStoredThenServed(): void
    {
        $cookie = 'access_token=' . $this->makeToken(['exp' => self::NOW + 600]);
        $fileCache = $this->makeFileCache();

        $first = $this->makeMiddleware()->processRequest($this->makeRequest($cookie));
        $first = $fileCache->processRequest($first);
        $this->assertFalse($first->hasResponse());
        $fileCache->processResponse($this->makeResponse($first, '{"fresh":true}'));

        $this->assertTrue($this->cacheExists($cookie));

        $second = $this->makeMiddleware()->processRequest($this->makeRequest($cookie));
        $second = $fileCache->processRequest($second);

        $this->assertTrue($second->hasResponse());
        $this->assertSame('{"fresh":true}', $second->response()->body());
    }
}
