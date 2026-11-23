# Reconciliation — Changes to existing routes

Part of the [Reconciliation spec](../README.md). This file lists every change reconciliation
makes to routes that already exist. Each change names the service it lands in, so the
implementation issue knows where to work.

## Transactions

- **PATCH** (`backend/src/bank/transaction.service.ts`, `update()`, after `#findTransaction`):
  when the row is cleared, a body whose `amount` or `date` differs from the stored value answers
  409 `TRANSACTION_CLEARED`. An unchanged value, `description` and `notes` pass. Order: 404, 400,
  `ACCOUNT_ARCHIVED`, the payment-generated 403, then `TRANSACTION_CLEARED`. A PATCH that moves a
  **ticked** row's date past the open statement's `statementDate`, or before the account's
  `opening_date`, unticks it. `update()` and `delete()` lock the row (`pessimistic_write`) inside
  a transaction and check `reconciliationId` on current data, so they cannot race a tick or a
  finish. They take the account lock first, in the common lock order (see
  [security.md](../security.md#concurrency)). The `reconciliation` field in the PATCH
  and POST responses comes from an account-scoped lookup.
- **DELETE** (`delete()`): a cleared row answers 409 `TRANSACTION_CLEARED`. Deleting a ticked row
  is allowed and drops the tick.
- **Responses and ledger rows** gain `reconciliation`: `null` (uncleared), or
  `{ id, status: 'open' | 'finished', statement_date }`. It is computed inside the ledger query
  (`backend/src/bank/ledger.query.ts`) with a `LEFT JOIN` on
  `r.id = t.reconciliation_id AND r.account_id = t.account_id`, with no query per row. The join is
  a PK lookup. The virtual `opening` row never carries it.
  - **Placement (recommendation, not a hard rule).** Apply the join outside the window subquery,
    on the at most 50 limited rows, so the whole-ledger window `SUM` of the running balance is not
    widened. The implementation issue may choose the other placement.
  - `payment_generated` uses a correlated `EXISTS`. The `LEFT JOIN` was chosen for the scope rule
    (see [security.md](../security.md#decided)), not by precedent.
- **Ledger envelope** gains `last_reconciled_date` (the latest finished `statement_date`, or
  `null`). The frontend uses it for the warning badge: an uncleared row dated on or before it.
  - Query: `SELECT MAX(statement_date) FROM bank_reconciliations WHERE account_id = :account AND
    reconciled_at IS NOT NULL`, served by the `(account_id, statement_date)` index.
  - It adds one query next to the `COUNT` and the last-page `openingEffective` in
    `transaction.service.ts`, so a ledger page takes 4 to 5 queries instead of 3 to 4.
  - The badge is derived in the frontend from this field alone, so it costs one envelope query per
    page and no per-row query (see [ui/ledger.md](../ui/ledger.md#warning-badge)).

## Accounts

- **Response** (the **detail only**, not the list) gains `last_reconciliation`:
  `{ statement_date, statement_balance, reconciled_at } | null`, and
  `open_reconciliation_id: number | null`. The list is unchanged: no list UI reads these fields,
  and the list does not carry statement balances (see
  [security.md](../security.md#decided)).
  - **Query.** One lookup over the `(account_id, statement_date)` index, run on the detail path
    only. `AccountPresenter.present()` is shared by the list and the detail, so gate the lookup
    like `listExtras` in `account.presenter.ts`: the list pays nothing and there is no N+1.
- **PATCH** (`backend/src/bank/account.service.ts`, `update()`): when any statement exists, open
  or finished, an `opening_date` or `opening_balance` that differs from the stored value answers
  409 `ACCOUNT_RECONCILED`. An open statement already depends on both (eligibility and the
  cleared balance), so locking only after a finish would let a PATCH break its invariants.
  Model it on the `CURRENCY_LOCKED` check in `#applyCurrency`. The check runs under the account
  row lock.
- **Currency** (`#applyCurrency`): when any statement exists, a currency change answers 409
  `CURRENCY_LOCKED` too, not only when transactions exist. A zero-row statement is stored in
  minor units of the old currency, and a change would silently reinterpret its balance.
- **DELETE** is unchanged. It needs no transactions, so a cascade only ever removes zero-row
  statements.

## Bill payments

- **Undo** — all three undo routes (debt occurrence, one-off `bills/:id/payment`, provider-bill
  occurrence) go through `undoPayment()` (`bill-payment-undo.ts`) and then
  `BillPaymentWriter.remove()`. Block there, in one place: if any linked payment, withdrawal or
  charge transaction is cleared, answer 409 `TRANSACTION_CLEARED`, checked under the same row
  locks as a finish. If a linked transaction is
  only ticked, the undo deletes it and the tick goes with it.
- **Bill and provider-bill DELETE** are already 409 when paid (`PROVIDER_BILL_PAID` and the
  like). No change: a paid bill is the only way to have generated transactions. Do not add a
  redundant check.

## Caching

Every route below lives on `@OwnerScopedController('bank')`, so writes clear the caller's own
`/bank` (or `/orgs/<id>/bank`) subtree. The mechanism and the error-body rules are stated once in
[reconciliations.md](reconciliations.md#caching); the general model is in
[Caching](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md#invalidation).

| Route | Class | Invalidated by |
|---|---|---|
| Ledger GET `accounts/:accountId/transactions.json` (now carrying `reconciliation` and `last_reconciled_date`) | `user-scoped` | Every reconciliation write (ticks change `reconciliation`, finish and undo change `status` and `last_reconciled_date`, cancel clears the ticks), and the transaction, account and payment-undo writes, as today |
| Account detail GET `accounts/:accountId.json` (now carrying `last_reconciliation` and `open_reconciliation_id`) | `user-scoped` | Start, cancel, finish, undo and edit (`statement_balance` / `statement_date`), and the account PATCH |
| Transaction POST / PATCH / DELETE | `never` | Already emits `InvalidatesOwner()`. It now also refreshes the statement GET and the history GET, because an auto-untick or a deleted ticked row changes `ticked_sum`, `difference` and `transaction_count` |
| Account PATCH | `never` | Unchanged (`InvalidatesOwner()`) |
| The three payment undos | `never` | Unchanged (`InvalidatesOwner()`). Deleting a ticked row changes the open statement |

- The whole owner `/bank` subtree is cleared on every write. This is the accepted coarseness of
  `caching.md#invalidation`, including its short race window. No per-account path invalidation is
  introduced.
- An org write never clears personal paths and a personal write never clears org paths. That is
  correct, because the data is disjoint.

## Accountant hand-off

No interaction with `sentToAccountantAt`. The hand-off and the cleared marker are independent.

## Error codes

Add the new codes to the error-code table of each affected route section in
[Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)
at fold time: `TRANSACTION_CLEARED` (transaction PATCH and DELETE, the three payment undos),
`ACCOUNT_RECONCILED` (account PATCH). See [reconciliations.md](reconciliations.md#error-codes)
for the full list.

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)
- [Bank — Transactions](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/transactions.md)
- [Bank — Accounts](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/accounts.md)
- [Bank — Bills](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md)
- [`transaction.service.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/transaction.service.ts)
- [`account.service.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/account.service.ts)
- [`ledger.query.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/ledger.query.ts)
- [`bill-payment-undo.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/bill-payment-undo.ts)

## Required tests

- `transactions.e2e-spec.ts`: changed versus unchanged amount and date, a description edit, a
  delete, and no bypass for `admin`; a ticked row moved before `opening_date` is unticked.
- `accounts.e2e-spec.ts`: the anchor lock while a statement is open, after a finish and after an
  undo; `CURRENCY_LOCKED` once a zero-row statement exists; the account list does **not** carry
  `last_reconciliation` or `open_reconciliation_id`, and the detail does.
- The bill-payment e2e specs: undo blocked when cleared, allowed when ticked.
- Ledger query units: the `reconciliation` field and `last_reconciled_date`.
- The ledger and account-detail GETs send `X-Cache-Allow` as user-scoped, and a 2xx transaction
  or account write carries the owner invalidation header (see
  [security.md](../security.md#required-tests)).

Back to the [README](../README.md).
