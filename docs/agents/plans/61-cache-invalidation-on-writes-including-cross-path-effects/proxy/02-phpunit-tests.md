# PHPUnit tests for the middleware

Add `proxy/extension/tests/middlewares/CacheInvalidationMiddlewareTest.php`:

- namespace `Tent\Middlewares\Tests`, extending `PHPUnit\Framework\TestCase`;
- `@SuppressWarnings(PHPMD.StaticAccess)` for `build()`.

## Fixtures

- In `setUp`, create an absolute temp location: `sys_get_temp_dir() . '/ward-cache-' . uniqid()`.
- Also create a sibling directory outside the location that holds a sentinel file.
- Populate the location with the Tent layout `{loc}/{path}/GET/{hash}.body.dat|.meta.json`:
  - `bank/accounts.json/GET/` with several hashes, standing for query and per-caller variants;
  - `bank/accounts/5/transactions.json/GET/`;
  - `bank.json/GET/`;
  - `orgs/3/bank/calendar.json/GET/`;
  - `orgs/4/bank/calendar.json/GET/`;
  - `orgs.json/GET/`;
  - `orgs/3.json/GET/`.
- Remove everything in `tearDown`.

Build a `Response` with `new Response(['httpCode' => …, 'headers' => [...], 'request' => new
ProcessingRequest(['requestMethod' => 'POST', 'requestPath' => '/bank/x.json'])])`. Check the
`ProcessingRequest` constructor keys in Tent's `models/ProcessingRequest.php`.

## Cases (the issue's acceptance criteria)

1. **2xx with `/bank`:**
   - every directory under `{loc}/bank` is gone, including all hashes and nested paths;
   - `bank.json`, `orgs/**` and `orgs.json` are untouched.
2. **2xx with `/orgs/3/bank`:** `orgs/3/bank` is cleared, while `orgs/4/bank` and `orgs/3.json`
   are untouched (organization isolation).
3. **2xx with `/orgs.json, /orgs/3.json`:** both are cleared, and `orgs/3/bank` and `orgs/4` are
   untouched.
4. **Non-2xx** (400, 401, 404, 500) with the header: nothing is cleared.
5. **GET or HEAD request** with a 200 and the header: nothing is cleared.
6. **Stripping:** the header is stripped in every case above, with mixed-case names such as
   `x-cache-invalidate` included. Other headers are preserved.
7. **Invalid paths are ignored:**
   - `bank` (relative), `/bank?x=1`, `/bank#a`, `/../outside`, `/bank/../..`, `/bank/./x`,
     `//bank`, `/`, `/%2e%2e`, `http://x/bank`;
   - a mixed list such as `/../outside, /orgs.json` still clears `/orgs.json`.
8. **Confinement:**
   - the sentinel outside the location survives every case;
   - a symlink inside the location pointing outside is never followed, and its target survives.
9. **Edge cases:**
   - a missing path directory or a non-existent location is a no-op without errors;
   - `build()` wires the location.

## Files to Change

- `proxy/extension/tests/middlewares/CacheInvalidationMiddlewareTest.php`: new test.
- `proxy/extension/tests/support/*`: only if a fixture-tree helper is extracted. Require it from
  `tests/bootstrap.php`.
