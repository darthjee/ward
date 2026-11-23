# Issue: Reconciliation — enhance the specs: migration, performance, memory and caching

## Description
Phase 2 of epic #85 (Reconciliation). This issue refines `docs/agents/specs/reconciliation/` on backward compatibility, migration, performance, memory and caching. The initial specs (#152) recorded those as provisional defaults. Roles, security and data access were settled by #153.

**Scope:** documentation only. No backend, frontend, cache-config or migration code is written here.

## Problem
Reconciliation adds the `bank_reconciliations` table and a nullable `reconciliation_id` FK on transactions. It also adds new locks on existing routes (`ACCOUNT_RECONCILED`, `TRANSACTION_CLEARED`, the currency lock) and computes the difference and cleared balance live, because balances are never stored. In `security.md#open-concerns` and `model.md#migration`, migration, query cost, memory and cache classes are still marked provisional. They must be confirmed before the implementation issues start.

## Expected Behavior
The spec states, and moves out of Open concerns into Decided:
- **Backward compatibility and migration**
  - The migration is additive, with no backfill: create the table, add the column with its FK and index, and add the generated `open_key` unique index.
  - Existing transactions start uncleared.
  - Existing clients keep working with the new response fields (`reconciliation`, `last_reconciled_date`, `last_reconciliation`, `open_reconciliation_id`) and the new 409s, which apply only once a statement exists.
  - The down migration is reversible: it drops the FK, the column, the indexes and the table, and reconcile data is lost on rollback. A spec covers both up and down.
- **Performance**
  - How the cleared balance, the ticked sum and the difference are computed in `AccountBalancesQuery`, and how the ledger `reconciliation` field and `last_reconciled_date` are computed in `ledger.query.ts`.
  - Which index serves each query: `(reconciliation_id)`, `(account_id, statement_date)` and `open_key`.
  - The expected cost on large ledgers, stated qualitatively: the worst case is the same as `currentBalance()`, a single indexed `SUM` over the account's ledger. No numeric latency target is set.
  - How the "uncleared row in a reconciled period" badge stays free of per-row queries.
- **Memory footprint** of a bulk tick (at most 50 ids, one DB transaction) and of a ledger page with reconcile data, within the 512 MB Render tier and the lazy `bank` module.
- **Caching**
  - The `@CachePolicy` class of each new route.
  - For each changed existing route (ledger, account detail, transaction writes), its cache class and which writes invalidate it, because ticks, finish, undo and cancel change those responses.
  - That 400 and 409 bodies are never cached.
  - Navi warms nothing. Every reconciliation GET is user-scoped and changes on every tick.

## Solution
The architect updates the reconciliation spec files (`model.md`, `security.md`, `api/*.md`, `README.md`) after consulting:
- `backend`, for the migration, queries, indexes and memory;
- `cache`, for the `@CachePolicy` classes, invalidation and Navi.

The #154 provisional markers are then removed, and the concerns owned by #155 are left in place. Documentation only.

## Benefits
- Implementation issues get a clear migration, indexing and caching contract.
- Cache-invalidation bugs from ticks, finishes and undos are designed out before any code exists.
