# Reconciliation — Security and open concerns

Part of the [Reconciliation spec](README.md). This file records the decided ownership, data
sensitivity, bounds, cache and memory rules, and the concerns deferred to the spec-enhancement
phase.

## Decided

| Topic | Decision |
|---|---|
| Ownership | Statements inherit the owner through their account and never store an owner column. Every route resolves the account owner-scoped first: a uniform 404 for a foreign, wrong-context or non-member id, and global `is_admin` gets no bypass. A ticks body may only name transactions of the same account: a foreign id answers 404 and the whole batch is rejected |
| Data sensitivity | Statement balances are financial data. Bodies are never logged. Statement responses never contain owner fields |
| Input bounds | Ticks arrays have at most 50 ids each, with ids validated like `parseId`. Amounts are at most 10¹³ minor units. Dates are at most UTC today + 1 day |
| Cache | No route is `public`. GETs are `user-scoped`, writes are `never` with `InvalidatesOwner()`. Navi warms nothing |
| Memory and module | Owned by the lazy `bank` module. It adds no dependency and no always-on code beyond one resident controller. The difference is a single `SUM` query, not in-memory work, so it fits the 512 MB Render tier |

## Open concerns

Deferred to the spec-enhancement phase. Each has a recommended default, **provisional — to be
settled in spec enhancement**.

- **Roles.** Start, edit, tick and finish need `user` (everyday writes). Cancel and undo need
  `admin`, since they discard or reverse, like every DELETE and payment undo.
- **Backward compatibility and migration.** The change is additive with no backfill (see
  [model.md](model.md#migration)). The only behaviour change for existing users is the anchor
  lock, and it starts only after their first finished statement.
- **Performance.** Indexes on `(reconciliation_id)` and `(account_id, statement_date)`. The
  ledger `LEFT JOIN` adds one indexed lookup per row. The worst case of the cleared-balance
  `SUM` is the account's whole ledger, the same as `currentBalance()`.
- **Mismatch surfacing beyond the difference bar and the badge.** Recommend none in this epic: no
  notifications and no account-list badge.
- **Checkpoint anchors as an alternative** (each finished statement becomes a new anchor for
  balances). Recommend rejecting it, since it would change the computed balance model. Keep it
  listed for the enhancement phase to confirm.
- **Account list payload.** Whether `last_reconciliation` and `open_reconciliation_id` are needed
  on the list, or only on the detail.

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Organizations](https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth/organizations.md)
- [Caching](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)

## Required tests

- A foreign, wrong-context or non-member account id answers a uniform 404 on every route, for
  both base paths, and global `is_admin` gets no bypass.
- A ticks body naming a transaction of another account answers 404 and changes nothing.
- Ticks arrays above 50 ids, overlapping `tick` and `untick`, empty bodies, a malformed id, an
  amount above the bound and a date beyond today + 1 day answer 400.
- Every GET sends `X-Cache-Allow` as user-scoped and every write sends `X-Skip-Cache`.

Back to the [README](README.md).
