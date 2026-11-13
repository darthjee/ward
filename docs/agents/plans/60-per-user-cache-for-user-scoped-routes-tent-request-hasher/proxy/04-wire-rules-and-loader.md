# Wire the rules and loader

Apply the shared-contract config to both backend rules. Rebase on #61 first, because it edits
the same files.

- Handler:
  - add `require_cache_header => 'X-Cache-Allow'`;
  - add `request_hasher => ['class' => 'Tent\\Cache\\AccessTokenRequestHasher']`;
  - add `additional_excluded_headers => ['Authorization']`;
  - keep `skip_cache_header => 'X-Skip-Cache'`.
- Add a rule-level `prependMiddlewares` key with
  `['class' => 'Tent\\Middlewares\\ExpiredTokenCacheBypassMiddleware']`.
- `CacheStalenessMiddleware`: add `additional_excluded_headers => ['Authorization']`.
- Leave `filter_query_params` unset, and add a comment that it must never drop a
  scope-defining param.
- Update the rule docblock to describe opt-in, per-caller caching. Remove the "shared by
  default" wording.

Confirm in Tent 1.1.0 (`Rule::build`, `RequestHandler::build`) that `prependMiddlewares` is
read from the rule params and that it runs before `FileCacheMiddleware`. If it does not, fall
back to building `FileCacheMiddleware` manually in `middlewares` after the bypass middleware,
with the same hasher, `require_cache_header` and excluded headers. Do not use the handler's
built-in cache in that case, and record the choice in `proxy.md`'s notes.

Check `loader.php` requires the three new files in dependency order: `AccessTokenCookie`, then
the hasher, then the middleware.

Manual check through `docker-compose up`:

- two users get their own data on the same user-scoped URL;
- a logged-out request gets 401 and no cached body;
- an expired-token request is not served from the cache;
- `grep -ri authorization` over the cache folder finds nothing.

## Files to Change
- `proxy/prod_configuration/rules/backend.php` — handler keys, `prependMiddlewares`, staleness exclusions, docblock
- `proxy/dev_configuration/rules/backend.php` — same as prod
- `proxy/extension/loader.php` — final ordering check
