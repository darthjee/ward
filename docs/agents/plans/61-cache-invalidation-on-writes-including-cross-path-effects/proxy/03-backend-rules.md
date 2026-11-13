# Wire it into the backend rules

In both `proxy/dev_configuration/rules/backend.php` and `proxy/prod_configuration/rules/backend.php`,
make these changes.

1. **Remove** the `Tent\\Middlewares\\CacheCleanupMiddleware` entry from `middlewares`. The header
   replaces it, and the plan found no gap that needs it kept (see `proxy.md` Notes).
2. **Add a `prependMiddlewares` key** to the rule. Its `processResponse` then runs before the
   handler's `FileCacheMiddleware` stores anything:

   ```php
   'prependMiddlewares' => [
       [
           'class'    => 'Tent\\Middlewares\\CacheInvalidationMiddleware',
           'location' => $cacheFolder
       ]
   ],
   ```

3. **Update the handler config:**
   - set `'cache' => $cacheFolder` explicitly, so Tent's store and the clear always share one
     folder;
   - add `'additional_excluded_headers' => ['X-Cache-Invalidate']` as a second layer against the
     header ever being cached or replayed.
4. **Keep the rest unchanged:** `SetClientIpMiddleware` and `CacheStalenessMiddleware` stay as
   they are.
5. **Update the file docblocks.** Replace the cleanup wording with the header-driven invalidation,
   and point to `docs/agents/architecture/caching.md`.

## Verifying

- Run the proxy lint and the PHPUnit suite.
- Then, in dev, use `docker-compose up` with the backend and the proxy:
  1. With a `public` GET cached, send a write that carries the header. Confirm in
     `docker_volumes/proxy_cache` that the subtree is gone.
  2. Confirm that the browser-facing response has no `X-Cache-Invalidate` header.

## Files to Change

- `proxy/dev_configuration/rules/backend.php`: remove the cleanup middleware, prepend the new
  middleware, add the handler `cache` and the excluded header, update the docblock.
- `proxy/prod_configuration/rules/backend.php`: the same changes.
