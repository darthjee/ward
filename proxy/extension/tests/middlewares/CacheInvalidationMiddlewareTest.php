<?php

namespace Tent\Middlewares\Tests;

use FilesystemIterator;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Tent\Middlewares\CacheInvalidationMiddleware;
use Tent\Models\ProcessingRequest;
use Tent\Models\Response;

/**
 * Unit tests for CacheInvalidationMiddleware (and, through it,
 * Tent\Cache\CacheSubtreeClearer).
 *
 * Each test runs against a real temporary Tent cache tree laid out as
 * `{location}/{path}/GET/{hash}.body.dat|.meta.json`.
 *
 * Run via docker-compose:
 *   docker-compose run proxy_tests
 */
class CacheInvalidationMiddlewareTest extends TestCase
{
    /**
     * Cached request paths populated in the fixture tree, each with the
     * number of hashes (query/per-caller variants) it holds.
     */
    private const CACHED_PATHS = [
        'bank/accounts.json' => 3,
        'bank/accounts/5/transactions.json' => 2,
        'bank.json' => 1,
        'orgs/3/bank/calendar.json' => 2,
        'orgs/4/bank/calendar.json' => 2,
        'orgs.json' => 1,
        'orgs/3.json' => 1,
    ];

    /**
     * @var string Temporary root holding both the cache location and the outside folder.
     */
    private string $root;

    /**
     * @var string The cache location.
     */
    private string $location;

    /**
     * @var string A folder outside the cache location holding a sentinel file.
     */
    private string $outside;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/ward-cache-' . uniqid('', true);
        $this->location = $this->root . '/cache';
        $this->outside = $this->root . '/outside';

        mkdir($this->outside . '/inner', 0777, true);
        file_put_contents($this->outside . '/sentinel.txt', 'keep');
        file_put_contents($this->outside . '/inner/sentinel.txt', 'keep');

        foreach (self::CACHED_PATHS as $path => $hashes) {
            $dir = $this->location . '/' . $path . '/GET';
            mkdir($dir, 0777, true);

            for ($index = 0; $index < $hashes; $index++) {
                $hash = sha1($path . $index);
                file_put_contents($dir . '/' . $hash . '.body.dat', '{}');
                file_put_contents($dir . '/' . $hash . '.meta.json', '{}');
            }
        }

        file_put_contents($this->location . '/bank/accounts.json/GET/abc.refreshing', '');
    }

    protected function tearDown(): void
    {
        if (!is_dir($this->root)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->root, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $entry) {
            if ($entry->isLink() || !$entry->isDir()) {
                unlink($entry->getPathname());
                continue;
            }

            rmdir($entry->getPathname());
        }

        rmdir($this->root);
    }

    /**
     * Builds a Response for the given status, headers and request method.
     */
    private function makeResponse(int $httpCode, array $headers, string $method = 'POST'): Response
    {
        return new Response([
            'httpCode' => $httpCode,
            'headers' => $headers,
            'request' => new ProcessingRequest([
                'requestMethod' => $method,
                'requestPath' => '/bank/x.json',
            ]),
        ]);
    }

    /**
     * Runs the middleware on a response carrying the given invalidation value.
     */
    private function process(string $value, int $httpCode = 200, string $method = 'POST'): Response
    {
        $middleware = new CacheInvalidationMiddleware($this->location);
        $response = $this->makeResponse($httpCode, [
            'Content-Type: application/json',
            'X-Cache-Invalidate: ' . $value,
            'X-Request-Id: abc-123',
        ], $method);

        return $middleware->processResponse($response);
    }

    private function assertCached(string $path): void
    {
        $this->assertDirectoryExists($this->location . '/' . $path . '/GET', "$path should still be cached");
    }

    private function assertCleared(string $path): void
    {
        $this->assertDirectoryDoesNotExist($this->location . '/' . $path, "$path should have been cleared");
    }

    private function assertNothingCleared(): void
    {
        foreach (array_keys(self::CACHED_PATHS) as $path) {
            $this->assertCached($path);
        }
    }

    private function assertOutsideIntact(): void
    {
        $this->assertFileExists($this->outside . '/sentinel.txt');
        $this->assertFileExists($this->outside . '/inner/sentinel.txt');
    }

    private function assertHeaderStripped(Response $response): void
    {
        $this->assertSame([
            'Content-Type: application/json',
            'X-Request-Id: abc-123',
        ], $response->headers());
    }

    /**
     * A 2xx write declaring `/bank` clears the whole personal bank subtree,
     * every hash and nested path included, and nothing else.
     */
    public function testClearsBankSubtree(): void
    {
        $response = $this->process('/bank');

        $this->assertCleared('bank');
        $this->assertCached('bank.json');
        $this->assertCached('orgs/3/bank/calendar.json');
        $this->assertCached('orgs/4/bank/calendar.json');
        $this->assertCached('orgs.json');
        $this->assertCached('orgs/3.json');
        $this->assertOutsideIntact();
        $this->assertHeaderStripped($response);
    }

    /**
     * Clearing one organization's bank never touches another organization.
     */
    public function testClearsOnlyTheGivenOrganizationBank(): void
    {
        $response = $this->process('/orgs/3/bank');

        $this->assertCleared('orgs/3/bank');
        $this->assertCached('orgs/4/bank/calendar.json');
        $this->assertCached('orgs/3.json');
        $this->assertCached('orgs.json');
        $this->assertCached('bank/accounts.json');
        $this->assertHeaderStripped($response);
    }

    /**
     * A comma-separated list clears every listed path.
     */
    public function testClearsEveryListedPath(): void
    {
        $response = $this->process(' /orgs.json ,  /orgs/3.json ');

        $this->assertCleared('orgs.json');
        $this->assertCleared('orgs/3.json');
        $this->assertCached('orgs/3/bank/calendar.json');
        $this->assertCached('orgs/4/bank/calendar.json');
        $this->assertCached('bank/accounts.json');
        $this->assertHeaderStripped($response);
    }

    /**
     * Several header lines are all honoured and all stripped.
     */
    public function testHonoursMultipleHeaderLines(): void
    {
        $middleware = new CacheInvalidationMiddleware($this->location);
        $response = $middleware->processResponse($this->makeResponse(201, [
            'X-Cache-Invalidate: /orgs.json',
            'Content-Type: application/json',
            'x-cache-invalidate: /orgs/3.json',
            'X-Request-Id: abc-123',
        ]));

        $this->assertCleared('orgs.json');
        $this->assertCleared('orgs/3.json');
        $this->assertHeaderStripped($response);
    }

    /**
     * Non-2xx responses never clear, but still lose the header.
     */
    public function testNonSuccessfulResponsesClearNothing(): void
    {
        foreach ([199, 300, 302, 400, 401, 404, 500] as $httpCode) {
            $response = $this->process('/bank, /orgs.json', $httpCode);

            $this->assertHeaderStripped($response);
        }

        $this->assertNothingCleared();
        $this->assertOutsideIntact();
    }

    /**
     * GET and HEAD responses (including replayed cache hits) never clear,
     * whatever the case of the method, but still lose the header.
     */
    public function testSafeMethodsClearNothing(): void
    {
        foreach (['GET', 'HEAD', 'get', 'head'] as $method) {
            $response = $this->process('/bank, /orgs.json', 200, $method);

            $this->assertHeaderStripped($response);
        }

        $this->assertNothingCleared();
    }

    /**
     * Every non-GET/HEAD write method may clear.
     */
    public function testWriteMethodsClear(): void
    {
        $this->process('/bank', 200, 'patch');
        $this->process('/orgs.json', 204, 'PUT');
        $this->process('/orgs/3.json', 200, 'DELETE');

        $this->assertCleared('bank');
        $this->assertCleared('orgs.json');
        $this->assertCleared('orgs/3.json');
    }

    /**
     * The header is stripped case-insensitively, other headers are kept in
     * order, and responses without the header are left untouched.
     */
    public function testStripsHeaderCaseInsensitively(): void
    {
        $middleware = new CacheInvalidationMiddleware($this->location);

        foreach (['x-cache-invalidate', 'X-CACHE-INVALIDATE', 'X-Cache-Invalidate '] as $name) {
            $response = $middleware->processResponse($this->makeResponse(404, [
                'Content-Type: application/json',
                $name . ': /bank',
                'X-Request-Id: abc-123',
            ]));

            $this->assertHeaderStripped($response);
        }

        $response = $middleware->processResponse($this->makeResponse(200, [
            'Content-Type: application/json',
            'X-Request-Id: abc-123',
        ]));

        $this->assertHeaderStripped($response);
        $this->assertNothingCleared();
    }

    /**
     * Invalid paths are ignored one by one, and never escape the location.
     */
    public function testIgnoresInvalidPaths(): void
    {
        $invalid = [
            'bank',
            '/bank?x=1',
            '/bank#a',
            '/../outside',
            '/bank/../..',
            '/bank/./accounts.json',
            '//bank',
            '/bank/',
            '/',
            '/%2e%2e',
            '/bank%2Faccounts.json',
            'http://x/bank',
            '/bank\\accounts.json',
            "/bank\0/accounts.json",
            '/..',
            '/.',
        ];

        foreach ($invalid as $path) {
            $response = $this->process($path);

            $this->assertHeaderStripped($response);
        }

        $this->assertNothingCleared();
        $this->assertOutsideIntact();
    }

    /**
     * An invalid entry does not stop the valid ones in the same list.
     */
    public function testValidEntriesSurviveInvalidOnes(): void
    {
        $this->process('/../outside, /orgs.json, /bank?x=1');

        $this->assertCleared('orgs.json');
        $this->assertCached('bank/accounts.json');
        $this->assertOutsideIntact();
    }

    /**
     * A symlink inside the subtree being cleared is unlinked, not followed.
     */
    public function testSymlinkInsideSubtreeIsNotFollowed(): void
    {
        symlink($this->outside, $this->location . '/bank/escape');

        $this->process('/bank');

        $this->assertCleared('bank');
        $this->assertOutsideIntact();
    }

    /**
     * A symlinked target, or a target reached through a symlink, is never
     * cleared.
     */
    public function testSymlinkedTargetIsNeverCleared(): void
    {
        symlink($this->outside, $this->location . '/escape');

        $this->process('/escape, /escape/inner');

        $this->assertTrue(is_link($this->location . '/escape'));
        $this->assertOutsideIntact();
    }

    /**
     * A path with no cached directory is a no-op.
     */
    public function testMissingPathIsNoOp(): void
    {
        $response = $this->process('/nothing/here.json, /bank/accounts.json/GET/missing');

        $this->assertHeaderStripped($response);
        $this->assertNothingCleared();
    }

    /**
     * A file (rather than a directory) at the target path is left alone.
     */
    public function testFileTargetIsNoOp(): void
    {
        $file = $this->location . '/bank/accounts.json/GET/abc.refreshing';

        $this->process('/bank/accounts.json/GET/abc.refreshing');

        $this->assertFileExists($file);
    }

    /**
     * A non-existent cache location is a no-op without errors.
     */
    public function testMissingLocationIsNoOp(): void
    {
        $middleware = new CacheInvalidationMiddleware($this->root . '/does-not-exist');

        $response = $middleware->processResponse($this->makeResponse(200, [
            'Content-Type: application/json',
            'X-Cache-Invalidate: /bank',
            'X-Request-Id: abc-123',
        ]));

        $this->assertHeaderStripped($response);
        $this->assertDirectoryDoesNotExist($this->root . '/does-not-exist');
        $this->assertNothingCleared();
    }

    /**
     * build() wires the location (and the default header name).
     *
     * @SuppressWarnings(PHPMD.StaticAccess) CacheInvalidationMiddleware::build()
     *     is the static factory contract mandated by the Tent middleware
     *     framework; this test exists specifically to exercise it.
     */
    public function testBuildWiresLocation(): void
    {
        $middleware = CacheInvalidationMiddleware::build(['location' => $this->location]);

        $response = $middleware->processResponse($this->makeResponse(200, [
            'Content-Type: application/json',
            'X-Cache-Invalidate: /orgs.json',
            'X-Request-Id: abc-123',
        ]));

        $this->assertCleared('orgs.json');
        $this->assertHeaderStripped($response);
    }

    /**
     * build() accepts a custom header name.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) CacheInvalidationMiddleware::build()
     *     is the static factory contract mandated by the Tent middleware
     *     framework; this test exists specifically to exercise it.
     */
    public function testBuildAcceptsCustomHeader(): void
    {
        $middleware = CacheInvalidationMiddleware::build([
            'location' => $this->location,
            'header' => 'X-Purge',
        ]);

        $response = $middleware->processResponse($this->makeResponse(200, [
            'X-Purge: /orgs.json',
            'X-Cache-Invalidate: /bank',
        ]));

        $this->assertCleared('orgs.json');
        $this->assertCached('bank/accounts.json');
        $this->assertSame(['X-Cache-Invalidate: /bank'], $response->headers());
    }

    /**
     * build() refuses a missing location.
     *
     * @SuppressWarnings(PHPMD.StaticAccess) CacheInvalidationMiddleware::build()
     *     is the static factory contract mandated by the Tent middleware
     *     framework; this test exists specifically to exercise it.
     */
    public function testBuildRequiresLocation(): void
    {
        $this->expectException(InvalidArgumentException::class);

        CacheInvalidationMiddleware::build([]);
    }
}
