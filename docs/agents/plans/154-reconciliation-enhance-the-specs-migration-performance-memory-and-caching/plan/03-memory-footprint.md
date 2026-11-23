# Memory footprint

Expand the `Memory and module` row of `security.md`'s `Decided` table into a short
`### Memory` subsection. It states the footprint within the 512 MB Render tier and the lazy
`bank` module.

**Lazy module**
- `ReconciliationsController` is the only resident addition. It is registered in
  `bank-routes.module.ts` and imports service types only.
- `ReconciliationService`, its queries and `reconciliation-conflicts.ts` load with the rest of
  `BankModule` on the first bank request, through the dynamic `import()` in
  `bank-module.loader.ts`. They are listed in `BankModule`, and in the `BankServices` interface
  where the controller needs them.
- No new dependency is added.

**Bulk tick** (at most 50 raw ids, one DB transaction)
- The pattern is the one of `accountant.service.ts` / `accountant-charges.query.ts`, but with
  the spec's cap of 50, not `MARK_MAX_IDS` (1000):
  1. de-duplicate the ids in memory;
  2. run one account-scoped `SELECT ... FOR UPDATE` of narrow columns only (`id`, `date`,
     `amount`, `reconciliation_id`), at most 50 rows;
  3. run one bulk `UPDATE ... SET reconciliation_id = ... WHERE id IN (...)` for `tick` and one
     for `untick`;
  4. recompute the statement with the two `SUM` queries.
- No entity hydration of full rows, and no per-id query.
- The footprint is a few kilobytes per request.

**Ledger page with reconcile data**
- It holds the same 50 rows as today, each with one more small object
  (`{ id, status, statement_date }`), plus one scalar in the envelope.
- The difference and the balances are computed in SQL. Ward never loads the ledger into memory
  to sum it.

**Finish and undo**
- Each one updates one statement row and runs the two `SUM`s under lock. No row list is loaded.

Conclusion to record: the epic adds no meaningful resident memory and a bounded, small
per-request footprint, and it fits the 512 MB tier.

## Files to Change
- `docs/agents/specs/reconciliation/security.md`: replace the one-line `Memory and module` row
  with a link to a new `### Memory` subsection holding the content above.
- `docs/agents/specs/reconciliation/api/reconciliations.md`: in the bulk-ticks bullet under
  `## Routes`, link to `security.md#memory` and state "one locking SELECT plus one bulk UPDATE
  per array".
