# Add CacheInvalidationMiddleware

Create `proxy/extension/lib/middlewares/CacheInvalidationMiddleware.php`.

## Class shape

- `namespace Tent\Middlewares;`, extending `Middleware`, in PSR-12 style.
- A docblock with a "Usage in configuration" example, as in `CacheControlMiddleware.php`.

## Construction

- The constructor takes the cache location (`string $location`) and an optional header name,
  defaulting to `X-Cache-Invalidate`.
- `public static function build(array $attributes): self` reads `location`, which is required,
  and `header`, which is optional.

## `processRequest`

Pass-through.

## `processResponse(Response $response): Response`

1. Split `$response->headers()` (raw `"Name: value"` lines) into the invalidation header lines,
   matched case-insensitively on the name before `:`, and the remaining lines.
2. Call `$response->setHeaders($remaining)`. This **always** happens.
3. Return early unless both of these hold:
   - `$response->isSuccessful()`;
   - the request method, uppercased from `$response->request()->requestMethod()`, is not GET or
     HEAD.
4. For each comma-separated, trimmed path across the header lines:
   - **validate** it (see the contract in `proxy.md`) and skip it if invalid;
   - **resolve the base** with `realpath($location)`. If that is false (the location does not
     exist yet), stop, since there is nothing to clear;
   - **build** `$dir = $base . '/' . implode('/', $segments)`;
   - **skip** if `!is_dir($dir)` or `is_link($dir)`;
   - **confine:** `realpath($dir)` must start with `$base . '/'`;
   - **delete the subtree** with `RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,
     SKIP_DOTS), CHILD_FIRST)`:
     - `unlink` files and links;
     - `rmdir` directories;
     - then `rmdir($dir)`.
     - Suppress and ignore races, such as a file vanishing mid-walk; a failed delete must never
       break the response.

     Removing `$dir` itself is fine: Tent recreates the directories on the next store.
5. Return `$response`.

Keep the validation and the recursive delete in small private methods, or a helper class in
`proxy/extension/lib/cache/`, so they can be tested in isolation.

## Loader

Register the class in `proxy/extension/loader.php` with
`require_once __DIR__ . '/lib/middlewares/CacheInvalidationMiddleware.php';`.

## Files to Change

- `proxy/extension/lib/middlewares/CacheInvalidationMiddleware.php`: the new middleware.
- `proxy/extension/loader.php`: the `require_once` line.
