# Performance and indexes

State how each computed value is queried and which index serves it, and give a qualitative cost
for large ledgers. No numeric latency target is set.

**`AccountBalancesQuery` (`backend/src/bank/account-balances.query.ts`)**, documented in
`model.md#formulas`, in a new `### Queries and indexes` subsection.
- **Cleared balance**:
  - The query is the `currentBalance()` shape (`SUM(t.amount)` with
    `WHERE t.account_id = :account AND t.date >= a.opening_date`), plus
    `INNER JOIN bank_reconciliations r ON r.id = t.reconciliation_id AND r.account_id = t.account_id AND r.reconciled_at IS NOT NULL`.
  - Indexes: `(account_id, date, id)` on transactions serves the range, and each join is a PK
    lookup on `bank_reconciliations`.
  - Worst case: the account's whole ledger, the same as `currentBalance()`.
- **Ticked sum**:
  - The query is `SUM(t.amount) WHERE t.reconciliation_id = :open AND t.account_id = :account`.
  - Index: `(reconciliation_id)`. The cost is proportional to the number of ticked rows, not to
    the ledger size.
- **Difference**: computed in the service as a `BigInt` from the two `SUM` strings, never a
  `Number`, and never in memory over rows.
  - The spec allows both values to come from one statement with conditional `SUM`s. Treat it as
    an implementation choice and do not mandate it.
- **`transaction_count`** on the statement and on history rows is `COUNT(*)` grouped by
  `reconciliation_id`, served by the `(reconciliation_id)` index.
  - The history page does one grouped query for its ≤ 50 statement ids, never one query per row.

**`ledger.query.ts`**, documented in `api/existing-routes.md#transactions`.
- **Row `reconciliation`**: the `LEFT JOIN` decided in #153, on
  `r.id = t.reconciliation_id AND r.account_id = t.account_id`. It is a PK lookup.
  - Recommendation: apply it outside the window subquery, on the ≤ 50 limited rows, so the
    whole-ledger window `SUM` is not widened.
  - Note that `payment_generated` uses a correlated `EXISTS`. The join was chosen for the scope
    rule, not by precedent.
- **Envelope `last_reconciled_date`**:
  - The query is `SELECT MAX(statement_date) FROM bank_reconciliations WHERE account_id = :account AND reconciled_at IS NOT NULL`.
  - Index: `(account_id, statement_date)`.
  - It adds one query, next to `COUNT` and `openingEffective`, in `transaction.service.ts`, so a
    page takes 4-5 queries instead of 3-4.

**Other lookups**
- Latest-finished lookup, chronology check, history order: `(account_id, statement_date)`.
- One-open check and race: the unique `open_key`.
- Account detail `last_reconciliation` and `open_reconciliation_id`: one query over the
  `(account_id, statement_date)` index, run on the detail path only (gated like `listExtras` in
  `account.presenter.ts`). The list pays nothing.

**Badge without per-row queries** (`api/existing-routes.md` and `ui/ledger.md`)
- The "uncleared row in a reconciled period" badge is computed in the frontend by comparing each
  row against the envelope `last_reconciled_date`: `reconciliation === null && date <=
  last_reconciled_date`.
- This costs one envelope query per page and zero per-row queries.

**Large ledgers** (qualitative, in `security.md` `Decided`)
- The worst case is a single indexed `SUM` over the account's ledger, the same as
  `currentBalance()` today. Every other reconciliation query is bounded by the ticked rows, the
  statements of one account, or the 50-row page.
- No new full scan, and no query per row.

## Files to Change
- `docs/agents/specs/reconciliation/model.md`: add `### Queries and indexes` under
  `## Formulas`, mapping each computed value to its query and index; keep the `## Index` notes
  consistent.
- `docs/agents/specs/reconciliation/api/existing-routes.md`: under `## Transactions`, describe the
  ledger `LEFT JOIN` placement, the `last_reconciled_date` envelope query and its index, and the
  query count. Under `## Accounts`, describe the detail-only lookup.
- `docs/agents/specs/reconciliation/api/reconciliations.md`: under the statement response and
  history envelope, add a pointer to the queries that compute `cleared_balance`, `ticked_sum`,
  `difference` and `transaction_count` (a grouped count, no N+1).
- `docs/agents/specs/reconciliation/ui/ledger.md`: confirm the badge is derived client-side from
  `last_reconciled_date`, if it is not already stated.
- `docs/agents/specs/reconciliation/security.md`: add a `Performance` row to `Decided`.
