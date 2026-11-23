# Caching and invalidation

Turn `api/reconciliations.md#caching` into a complete cache contract, and give every changed
existing route its class and invalidation. The facts come from the `cache` specialist's review.

**Mechanism** (stated once, linked from elsewhere)
- Every route lives on a controller declared with `@OwnerScopedController('bank')`.
  `ReconciliationsController` is no exception.
  - That controller decorator sets class-level `CacheClass.UserScoped` and class-level
    `InvalidatesOwner()`.
  - On a successful write, `InvalidatesOwner()` emits `/bank` in the personal context, or
    `/orgs/<orgId>/bank` in an org context, only for the caller's own context.
  - Tent clears that subtree recursively, and only on 2xx.
- Each write route declares `@CachePolicy(CacheClass.Never)`. Writes must not use
  `NoCacheInvalidation()` or `InvalidatesPaths()`.
- `cache-policy.coverage.spec.ts` enforces that every route declares a class.

**New routes** (add a `Cache` and an `Invalidates` column, or a sub-table, in
`api/reconciliations.md`)
- `user-scoped`, no invalidation: the history GET and the statement GET.
- `never`, `InvalidatesOwner()`: start (POST), edit (PATCH), cancel (DELETE), ticks (PATCH),
  finish (POST) and undo (POST).

**Changed existing routes** (add to `api/existing-routes.md`, one new `## Caching` section)

| Route | Class | Invalidated by |
|---|---|---|
| Ledger GET `accounts/:accountId/transactions.json` (now carrying `reconciliation`, `last_reconciled_date`) | `user-scoped` | Every reconciliation write (ticks change `reconciliation`, finish and undo change `status` and `last_reconciled_date`, cancel clears ticks), and the transaction, account and payment-undo writes, as today |
| Account detail GET `accounts/:accountId.json` (now carrying `last_reconciliation`, `open_reconciliation_id`) | `user-scoped` | Start, cancel, finish, undo and edit (`statement_balance` / `statement_date`), and the account PATCH |
| Transaction POST / PATCH / DELETE | `never` | Already emits `InvalidatesOwner()`. It now also refreshes the statement GET and history GET, because an auto-untick or a deleted ticked row changes `ticked_sum`, `difference` and `transaction_count` |
| Account PATCH | `never` | Unchanged (`InvalidatesOwner()`) |
| The three payment undos | `never` | Unchanged (`InvalidatesOwner()`). Deleting a ticked row changes the open statement |

- Granularity: the whole owner `/bank` subtree is cleared on every write. This is accepted
  coarseness, as in `caching.md#invalidation`, including its short race window. No per-account
  path invalidation is introduced.
- An org write never clears personal paths, and a personal write never clears org paths. That is
  correct, because the data is disjoint.

**Error bodies**
- 400 and 409 bodies are never cached, for two reasons:
  - `CachePolicyInterceptor` sets `X-Skip-Cache` and `no-store` on every non-GET/HEAD before the
    handler runs, so thrown errors carry them;
  - Tent caches only 2xx responses carrying `X-Cache-Allow`.
- Guard 404 and 403 responses carry no cache headers and are not 2xx, so they are not cached
  either.
- Failed writes (4xx/5xx) emit no invalidation. That is correct, because nothing changed.
- Link `caching.md#response-headers`.

**Navi**
- Navi warms nothing. Every reconciliation GET is user-scoped and changes on every tick.
  `navi/navi_config.yaml` warms nothing under `/bank` and needs no change. The proxy's `*.json`
  rule needs no change either.

**Required tests** (`security.md#required-tests`)
- Keep the existing bullet about `X-Cache-Allow` and `X-Skip-Cache`.
- Add a bullet: a 2xx tick, finish, undo or cancel carries the `/bank` (or `/orgs/<id>/bank`)
  invalidation header, and a 409 does not.

## Files to Change
- `docs/agents/specs/reconciliation/api/reconciliations.md`: rewrite `## Caching` (mechanism,
  per-route class and invalidation, error bodies, Navi). Make sure the routes table's `Cache`
  column matches it.
- `docs/agents/specs/reconciliation/api/existing-routes.md`: add `## Caching` with the
  changed-routes table, and link `caching.md#invalidation`.
- `docs/agents/specs/reconciliation/security.md`: expand the `Cache` row of `Decided` to point at
  the two sections above. Add the invalidation test bullet. Add the `caching.md` anchors
  (`#cache-classes`, `#response-headers`, `#invalidation`, `#navi-warm-up`, `#per-user-cache`)
  to `## Reference` as needed.
