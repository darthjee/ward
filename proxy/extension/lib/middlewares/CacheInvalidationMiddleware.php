<?php

namespace Tent\Middlewares;

use InvalidArgumentException;
use Tent\Cache\CacheSubtreeClearer;
use Tent\Models\Response;

/**
 * Clears cached GET paths declared by a successful write through the
 * `X-Cache-Invalidate` response header, and always strips that header.
 *
 * The backend sends `X-Cache-Invalidate: <path>[, <path>…]` on successful
 * writes. After the upstream call, this middleware:
 *
 * 1. removes every invalidation header line (name matched
 *    case-insensitively) from the response, whatever the status or method,
 *    so it is never stored in the cache nor sent to the client;
 * 2. only when the response is 2xx **and** the request method is neither
 *    GET nor HEAD, recursively clears each listed path's subtree in the
 *    cache location (see {@see CacheSubtreeClearer}). Invalid entries are
 *    ignored one by one.
 *
 * The method check also stops a header replayed from a cache hit from ever
 * triggering a clear.
 *
 * Register it under the rule's `prependMiddlewares` key so it runs before
 * the handler's `FileCacheMiddleware` processes the response.
 *
 * ## Usage in configuration
 *
 * ```php
 * Configuration::buildRule([
 *     'handler' => [...],
 *     'matchers' => [...],
 *     'prependMiddlewares' => [
 *         [
 *             'class' => 'Tent\\Middlewares\\CacheInvalidationMiddleware',
 *             'location' => $cacheFolder
 *         ]
 *     ]
 * ]);
 * ```
 */
class CacheInvalidationMiddleware extends Middleware
{
    public const DEFAULT_HEADER = 'X-Cache-Invalidate';

    /**
     * Request methods that never trigger a clear.
     */
    private const SAFE_METHODS = ['GET', 'HEAD'];

    /**
     * @var string Name of the invalidation header.
     */
    private string $header;

    /**
     * @var CacheSubtreeClearer Validates paths and clears cache subtrees.
     */
    private CacheSubtreeClearer $clearer;

    /**
     * @param string $location The cache location (the same folder FileCacheMiddleware uses).
     * @param string $header   Name of the invalidation header.
     */
    public function __construct(string $location, string $header = self::DEFAULT_HEADER)
    {
        $this->header = $header;
        $this->clearer = new CacheSubtreeClearer($location);
    }

    /**
     * Builds a CacheInvalidationMiddleware instance from given attributes.
     *
     * @param array $attributes Associative array of attributes; requires
     *                          'location' and supports an optional 'header'.
     * @return CacheInvalidationMiddleware The constructed middleware instance.
     * @throws InvalidArgumentException When 'location' is missing or empty.
     */
    public static function build(array $attributes): CacheInvalidationMiddleware
    {
        $location = (string) ($attributes['location'] ?? '');

        if ($location === '') {
            throw new InvalidArgumentException('CacheInvalidationMiddleware requires a "location" attribute');
        }

        return new self($location, (string) ($attributes['header'] ?? self::DEFAULT_HEADER));
    }

    /**
     * Strips the invalidation header and, for successful writes, clears the
     * declared cache subtrees.
     *
     * @param Response $response The response to process.
     * @return Response The response, without the invalidation header.
     */
    public function processResponse(Response $response): Response
    {
        $targetName = strtolower($this->header);
        $values = [];
        $remaining = [];

        foreach ($response->headers() as $headerLine) {
            $name = strtolower(trim(strstr($headerLine, ':', true) ?: $headerLine));

            if ($name === $targetName) {
                $values[] = (string) substr(strstr($headerLine, ':'), 1);
                continue;
            }

            $remaining[] = $headerLine;
        }

        $response->setHeaders($remaining);

        if (!$this->shouldInvalidate($response)) {
            return $response;
        }

        foreach ($this->paths($values) as $path) {
            $this->clearer->clear($path);
        }

        return $response;
    }

    /**
     * Whether the response is a successful write that may clear the cache.
     *
     * @param Response $response The response being processed.
     * @return boolean True when the response is 2xx and the method is not GET/HEAD.
     */
    private function shouldInvalidate(Response $response): bool
    {
        if (!$response->isSuccessful()) {
            return false;
        }

        $method = strtoupper((string) $response->request()->requestMethod());

        return $method !== '' && !in_array($method, self::SAFE_METHODS, true);
    }

    /**
     * Splits the header values on commas into trimmed, non-empty paths.
     *
     * @param array $values The raw header values.
     * @return array The candidate paths.
     */
    private function paths(array $values): array
    {
        $paths = [];

        foreach ($values as $value) {
            foreach (explode(',', $value) as $entry) {
                $entry = trim($entry);

                if ($entry !== '') {
                    $paths[] = $entry;
                }
            }
        }

        return $paths;
    }
}
