# Plan: Reconciliation — enhance the specs: migration, performance, memory and caching

Issue: [154-reconciliation-enhance-the-specs-migration-performance-memory-and-caching.md](../../issues/154-reconciliation-enhance-the-specs-migration-performance-memory-and-caching.md)

## Overview

Phase 2 of epic #85. This change is documentation only, and the architect makes it in
`docs/agents/specs/reconciliation/`. It settles the four topics #152 left provisional and moves
them from `security.md#open-concerns` into `Decided`: backward compatibility and migration,
performance, memory, and caching. The #155 concerns (mismatch surfacing, checkpoint anchors)
stay open. No backend, frontend, Navi or migration code is written.

## Context

The `backend` and `cache` specialists were consulted while planning. The facts below are what
the spec text must match.

**Migrations (backend)**
- Migrations are named `<YYYYMMDD>1200<NN>` with a global counter. The next one is
  `<date>120027-bank-create-reconciliations.ts`, class `BankCreateReconciliations<date>120027`.
- Generated columns, their unique indexes and FK additions are written as raw SQL, because
  `getTable` / generated-column helpers hit a `typeorm_metadata` table the project never creates.
  - Precedent for the generated column: `20261108120016-bank-create-accounts.ts:22-27`, which
    adds `active_name_key ... VIRTUAL` and its unique index.
  - Precedent for the nullable FK and index on an existing table:
    `20261117120025-bank-expand-provider-bills.ts:67-71`.
- `down()` runs in reverse order:
  - drop the FK, then the index, then the column, each step guarded through
    `information_schema` (`20261117120025...:192-204`);
  - drop a generated column together with its index;
  - drop tables last, with `DROP TABLE IF EXISTS`.
- Tests follow three existing patterns:
  - a unit spec `database/tests/bank-create-reconciliations-migration.spec.ts`, using
    `fake-query-runner.ts` and asserting call order;
  - `integration/migrations-round-trip.integration-spec.ts`, which runs up, down, up;
  - `migrations-registry.integration-spec.ts`, which needs the migration added to
    `MIGRATIONS` in `test-data-source.ts`.

**Queries (backend)**
- `bank_transactions` has a single secondary index, `idx_bank_transactions_account_id_date_id`
  on `(account_id, date, id)`. It serves the ledger order, the running balance and the balance
  `SUM`s.
- `currentBalance(s)` in `account-balances.query.ts:29-62` is one grouped
  `SUM(t.amount) ... JOIN bank_accounts ... WHERE t.account_id IN (...) AND t.date >= a.opening_date`.
- `ledger.query.ts` works like this:
  - pages hold 50 rows (`LEDGER_PER_PAGE`), fetched with `LIMIT/OFFSET`;
  - the running balance is a window `SUM` in an inner subquery over the whole account ledger;
  - `payment_generated` is a correlated, owner-scoped `EXISTS` in the select list
    (`payment-generated.query.ts:19-32`).
- A ledger page takes 3 or 4 queries today, orchestrated in `transaction.service.ts:77-84`:
  `findOwned`, `COUNT`, the page query, and `openingEffective` on the last page only.

**Account detail and memory (backend)**
- `AccountService.find` calls `AccountPresenter.present([account])`
  (`account.presenter.ts:42-67`), which runs one grouped balance query plus the type details.
  The list path uses `{ listExtras: true }`.
- `bank` is lazy: `bank-module.loader.ts:50-52` runs a dynamic `import('./bank.module.js')` on
  the first request. Controllers import service types only.
- The bulk precedent is `MarkChargesDto`, which caps at `MARK_MAX_IDS = 1000`. It does one
  `SELECT ... FOR UPDATE` of narrow columns and one bulk `UPDATE ... WHERE id IN (...)`, all in
  one DB transaction (`accountant.service.ts:117-135`).

**Caching (cache)**
- The cache classes are `Public`, `UserScoped` and `Never`.
- `OwnerScopedController('bank')` sets class-level `UserScoped` and class-level
  `InvalidatesOwner()`. It emits `/bank` in the personal context or `/orgs/<id>/bank` in an org
  context, only the caller's own context, after the handler returns. The proxy clears that
  subtree recursively, and only on a 2xx response.
- `CachePolicyInterceptor` sets `X-Skip-Cache` + `no-store` on every non-GET/HEAD before the
  handler runs, so error bodies carry it too.
- Tent caches only 2xx responses that carry `X-Cache-Allow` (`proxy/*/rules/backend.php`).
  Guard 404/403 responses carry no cache headers, which is harmless.
- Current cache classes of the routes the epic touches:
  - user-scoped: ledger GET (`transactions.controller.ts:42`), account detail GET
    (`accounts.controller.ts:78`);
  - `Never`, with the inherited `InvalidatesOwner`: transaction POST/PATCH/DELETE, account
    PATCH, and the three payment undos.
- `navi/navi_config.yaml` warms nothing. Bank data must never be warmed.
- `cache-policy.coverage.spec.ts` enforces the class on every route.

## Steps

- [01 — Backward compatibility and migration](plan/01-backward-compatibility-and-migration.md)
- [02 — Performance and indexes](plan/02-performance-and-indexes.md)
- [03 — Memory footprint](plan/03-memory-footprint.md)
- [04 — Caching and invalidation](plan/04-caching-and-invalidation.md)
- [05 — Close the #154 open concerns and sync the README](plan/05-close-open-concerns-and-readme.md)

## Notes

- **Ledger row field: keep the `LEFT JOIN` decided in #153.** The existing `payment_generated`
  precedent is a correlated `EXISTS`, but #153 settled a `LEFT JOIN` on
  `r.id = t.reconciliation_id AND r.account_id = t.account_id`.
  - The join is a PK lookup, one per row in the inner subquery, so it is cheap.
  - The spec should say the join is placed **outside** the window subquery, on the 50 limited
    rows, so the window `SUM` over the whole ledger is not widened.
  - The implementation issue may still choose the other placement. Record that as a
    recommendation, not a hard rule.
- **Account-list N+1 is avoided.** `present()` is shared by the list and the detail. Gate the
  reconcile lookup like `listExtras`, so only the detail pays for it, per #153's
  detail-only decision.
- **Bulk-ticks cap.** The cap of 50 in the spec is deliberately smaller than `MARK_MAX_IDS`
  (1000). The memory section should reference the pattern, not the number.
- **`open_key` collation.** `open_key` holds an `INT`, not a string, so it needs no collation,
  unlike `active_name_key`.
- **Out of scope.** Do not touch the #155 concerns, the UI files beyond a cache mention, or any
  code.
- **Security review.** It is not needed: no code, endpoint or proxy rule changes.
- **CI.** No CI job validates the docs content beyond the usual checks.
