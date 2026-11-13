# Issue: Cache invalidation on writes, including cross-path effects

## Description

Decide and implement how create / update / delete requests invalidate cached GET responses,
including GETs on **other paths** that the write changed. Ward routes have no `/api` prefix: the
paths are `/bank/...`, `/orgs/:orgId/bank/...`, `/orgs.json` and `/auth/...`.

### How it works today

Sources: Tent 1.1.0, `proxy/prod_configuration/rules/backend.php` and
`docs/agents/architecture/caching.md` § Invalidation.

- **Layout.** Tent stores each response as `{location}/{path}/GET/{hash}.body.dat` plus
  `.meta.json`. The hash is `sha256(query)` today, and becomes `sha256(token|query)` with #60.
- **Cleanup.** `CacheCleanupMiddleware` (`clear => ['collection', 'entity']`) runs on every
  POST / PATCH / PUT / DELETE.
- **Collection.** It is derived by dropping the last path segment. That never matches Ward's
  `.json` lists: a write to `/bank/accounts/5.json` clears `{loc}/bank/accounts/GET`, not
  `{loc}/bank/accounts.json/GET`. In practice only a single-level POST clears its own list.
- **Timing.** Cleanup runs **before** the upstream call and **whatever the response status**, so
  a 4xx or 401 also clears.
- **Clear scope.** Clearing a path removes its whole `GET` directory: every query variant and
  every per-caller entry. It is not recursive into sub-paths.
- **Freshness.** It is stale-while-revalidate (`maxAgeSeconds => 10`) with no hard expiry, so an
  entry that is never cleared can stay wrong indefinitely.

### The problem

Many writes change GETs on other paths that collection / entity cleanup never reaches. Each of
the following exists under both `/bank` and `/orgs/:orgId/bank`.

- **Transactions** change the account (balance), `accounts.json` and the ledger pages.
- **Archive / unarchive / account edits** change `accounts/:id.json` and the filtered lists.
- **Bills, payments, skips and undo** change:
  - `calendar.json` and `calendar/overdue.json`;
  - `bill-payments.json`;
  - the ledgers and balances of **two** accounts;
  - `accountant/charges.json`.
- **Accountant mark-sent / unsent** change the charges list and the provider ledgers.
- **Organizations.** `PATCH /orgs/:id.json` changes `/orgs.json`.

Several of these writes name the affected accounts **only in the request body**: the
`paying_account_id` of a payment, the provider of a new bill, the account ids of mark-sent. A
path-pattern map (Tent's `custom` option) cannot see them.

## Decisions

- **Mechanism: the backend declares, the proxy clears after a 2xx.**
  - Each write response carries `X-Cache-Invalidate: <path>[, <path>…]`.
  - A new Ward proxy middleware in `proxy/extension/` reads the header in `processResponse` and
    clears those paths only when the status is 2xx. It always strips the header before the
    response reaches the client.
  - Clearing after the upstream call removes most of the write-vs-GET race, and stops failed or
    unauthenticated writes from clearing the cache.
- **Granularity: the owner's subtree.**
  - Any successful bank write invalidates the owner's whole bank tree: `/bank` for personal
    writes, `/orgs/:orgId/bank` for organization writes. This covers accounts that are named only
    in the body, and both prefixes, without a per-route map.
  - A clear is **recursive**: every `GET` directory under the given path. Tent's `cleanPath` only
    clears one directory, so the Ward middleware implements the recursive clear itself, confined
    to the cache location.
  - Organization writes invalidate `/orgs.json`, plus the organization's own paths where they
    change.
  - Accepted cost: `/bank/...` is one path shared by every user, so one user's personal write
    clears every user's personal bank entries. Organization paths include `orgId`, so an org
    write clears every member's entries for that org, which is required.
- **Backend contract.**
  - The backend computes the targets, for example in an interceptor or helper that knows the
    owner and adds the right base prefix, so both prefixes are covered without duplicate entries.
  - Every non-GET route declares its invalidation: a metadata decorator next to `@CachePolicy`,
    an owner-scoped default, or an explicit "none" for `auth` / `admin` writes, which have no
    cached GETs.
  - The cache-policy coverage spec (`backend/src/core/tests/cache-policy.coverage.spec.ts`)
    fails on any non-GET route without a declaration.
- **Tent's `CacheCleanupMiddleware`** is removed from the backend rule, dev and prod, because the
  header replaces it. Keep it only if the plan finds a concrete gap the header cannot cover.
- **Header safety.**
  - The proxy only honours the header on backend responses.
  - It accepts only absolute paths without `..`, query or scheme, and never clears outside the
    cache location.
  - The header is never sent to the browser.
- **Race windows: accepted.**
  - A GET that misses while a write is in flight can still store pre-write data.
  - Tent's `BackgroundRefresher` can store a response fetched before the commit, and it ignores
    `skip_cache_header` / `require_cache_header`.
  - Both heal within about `maxAgeSeconds` (10 s) plus one read. Raise "the refresher honours the
    skip / require headers" upstream on Tent, which #60 also needs.
- **Writes that bypass the proxy.** There are none today (no jobs, cron or CLI; migrations run
  with the deploy, and Render's ephemeral disk resets the cache). Any future out-of-band writer
  must either call a purge path or keep its data uncached. This is recorded in the docs, and no
  purge endpoint is built now.

## Scope

- **`proxy` agent:**
  - the invalidation middleware (header parsing, the 2xx check, recursive clear, stripping),
    registered in `loader.php`, with PHPUnit tests;
  - the dev and prod backend rules: add the middleware, remove `CacheCleanupMiddleware`.
- **`backend` agent:**
  - the invalidation declaration and the code that emits `X-Cache-Invalidate` for owner-scoped
    bank writes and organization writes;
  - the coverage-spec rule, and e2e specs asserting the header on representative writes.
- **Docs (architect):**
  - `docs/agents/architecture/caching.md` § Invalidation;
  - `docs/agents/architecture/proxy.md` and `docs/agents/flow.md`;
  - the `cache` agent's review rules, in `.claude/agents/cache.md` and `.github/agents/`, gain
    "every write declares invalidation".
- The `cache` and `security` agents review the result.

## Out of scope

- The per-user cache itself: #60, which lands after this issue.
- A manual or administrative purge endpoint.
- Fixing Tent's refresher: upstream follow-up.

## Acceptance criteria

- PHPUnit covers the middleware:
  - a 2xx with the header clears every listed path recursively, including all query and
    per-caller entries;
  - a non-2xx clears nothing;
  - the header is stripped;
  - invalid paths (`..`, relative, or with a query) are ignored;
  - nothing outside the cache location is touched.
- Backend specs:
  - personal and organization bank writes emit their owner's bank prefix;
  - `PATCH /orgs/:id.json` emits `/orgs.json`;
  - the coverage spec fails on an undeclared write route.
- Through the proxy:
  - after a payment, the paying account's ledger and balance, `calendar.json` and `overdue.json`
    are served fresh on the next GET;
  - a write in one organization does not clear another organization's entries.
- The docs describe the new model, and the existing proxy and backend tests pass.

## Related

- #60: per-user cache for user-scoped routes. It depends on this issue.
- #46: organizations backend and the dual-prefix owner-scoped routes.
- Epic #26: the bank module, whose writes motivate this.
