# AccessTokenRequestHasher

Create `Tent\Cache\AccessTokenRequestHasher implements Tent\Cache\RequestHasher` (Tent 1.1.0
interface: `hash(RequestInterface $request): string` and `static build(array $params): self`).

- `build(array $params)`: accepts an optional `cookie` / `cookieName` option, default
  `access_token`, and ignores the `class` key that Tent passes along.
- `hash($request)`:
  - when `AccessTokenCookie::token()` returns a token, returns
    `hash('sha256', $token . '|' . $request->query())`;
  - otherwise returns `hash('sha256', $request->query())`, byte-identical to
    `QueryRequestHasher`, so anonymous entries stay shared.
- The hasher does not check expiry; that is the middleware's job in step 03. The raw token
  never appears in the key.

Tests in `proxy/extension/tests/cache/AccessTokenRequestHasherTest.php`, matching the
acceptance criteria:

- the same token and query give the same key;
- different tokens with the same query give different keys;
- the same token with different queries gives different keys;
- no token gives `hash('sha256', $query)` (equal to `QueryRequestHasher`'s output);
- the raw token is not a substring of the key;
- `build([])` and `build(['class' => ..., 'cookie' => 'other'])` both work, and a custom
  cookie name is honoured.

## Files to Change
- `proxy/extension/lib/cache/AccessTokenRequestHasher.php` — new hasher
- `proxy/extension/tests/cache/AccessTokenRequestHasherTest.php` — new tests
- `proxy/extension/loader.php` — `require_once` after `AccessTokenCookie.php`
