<?php

namespace Tent\Cache;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;
use Throwable;

/**
 * Validates cache-invalidation paths and recursively clears the matching
 * subtree of a Tent file cache.
 *
 * Tent's `FileCacheMiddleware` stores each entry under
 * `{location}/{request path}/{METHOD}/...`, with the request path stored raw
 * (not URL-decoded). Clearing the directory `{location}/{path segments}`
 * therefore removes every cached entry whose request path equals the given
 * path or lies under it as a path-segment prefix — every method directory,
 * every hash (query/caller variant) and every `.refreshing` sentinel.
 *
 * Safety rules:
 *
 * - a path is accepted only when {@see isValidPath()} says so (absolute, no
 *   query/fragment/scheme/backslash/NUL/percent-encoding, no empty, `.` or
 *   `..` segment, and not `/` itself);
 * - the target directory must resolve (via `realpath`) strictly inside the
 *   cache location;
 * - symbolic links are unlinked, never followed;
 * - filesystem races (an entry vanishing mid-walk) are swallowed: a failed
 *   delete must never break the response being served.
 */
class CacheSubtreeClearer
{
    /**
     * Substrings that make a path invalid wherever they appear.
     */
    private const FORBIDDEN_SUBSTRINGS = ['?', '#', '\\', "\0", '://', '%'];

    /**
     * @var string The cache location (the same folder FileCacheMiddleware uses).
     */
    private string $location;

    /**
     * @param string $location The cache location (the same folder FileCacheMiddleware uses).
     */
    public function __construct(string $location)
    {
        $this->location = $location;
    }

    /**
     * Checks whether the given path is an acceptable invalidation target.
     *
     * @param string $path The candidate URL path (e.g. `/orgs.json`).
     * @return boolean True when the path may be cleared.
     */
    public function isValidPath(string $path): bool
    {
        if ($path === '' || $path[0] !== '/' || $path === '/') {
            return false;
        }

        foreach (self::FORBIDDEN_SUBSTRINGS as $forbidden) {
            if (strpos($path, $forbidden) !== false) {
                return false;
            }
        }

        foreach ($this->segments($path) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return false;
            }
        }

        return true;
    }

    /**
     * Recursively clears the cache subtree for the given path.
     *
     * Invalid paths, a missing cache location, a missing target directory, a
     * symlinked target or a target escaping the cache location are all
     * silently ignored.
     *
     * @param string $path The URL path whose cache subtree should be cleared.
     * @return boolean True when a directory was found and removed.
     */
    public function clear(string $path): bool
    {
        if (!$this->isValidPath($path)) {
            return false;
        }

        $base = realpath($this->location);

        if ($base === false) {
            return false;
        }

        $dir = $base . '/' . implode('/', $this->segments($path));

        if (is_link($dir) || !is_dir($dir)) {
            return false;
        }

        $resolved = realpath($dir);

        if ($resolved === false || strpos($resolved, $base . '/') !== 0) {
            return false;
        }

        $this->removeTree($resolved);

        return true;
    }

    /**
     * Splits a path into its segments, dropping the leading slash.
     *
     * @param string $path An absolute URL path.
     * @return array The path segments.
     */
    private function segments(string $path): array
    {
        return explode('/', substr($path, 1));
    }

    /**
     * Removes a directory and everything under it, without following
     * symbolic links, ignoring any filesystem race.
     *
     * @param string $dir The directory to remove.
     * @return void
     */
    private function removeTree(string $dir): void
    {
        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST
            );

            foreach ($iterator as $entry) {
                $this->removeEntry($entry);
            }
        } catch (Throwable $error) {
            // A file or folder vanished mid-walk (concurrent clear or store):
            // nothing left to do for it.
        }

        @rmdir($dir);
    }

    /**
     * Removes a single entry found while walking the tree.
     *
     * @param SplFileInfo $entry The entry to remove.
     * @return void
     */
    private function removeEntry(SplFileInfo $entry): void
    {
        $pathname = $entry->getPathname();

        if ($entry->isLink() || !$entry->isDir()) {
            @unlink($pathname);
            return;
        }

        @rmdir($pathname);
    }
}
