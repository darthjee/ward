# Reconciliation — Security and open concerns

Part of the [Reconciliation spec](README.md). This file records the decided roles, ownership,
response fields, data sensitivity, input bounds, concurrency, cache and memory rules, and the
concerns still deferred to later spec-enhancement issues.

## Decided

| Topic | Decision |
|---|---|
| Roles | Start, edit statement, tick and finish need `user` (everyday writes). Cancel (a DELETE) and undo need `admin`, like every DELETE and payment undo in [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md#minimum-role). GETs are open to every member, the personal context counts as `owner`, and nothing is owner-only. Each write route declares `@MinOrgRole`, enforced by `OwnerContextGuard` (the `min-org-role.coverage.spec.ts` guard fails on a missing one). Finish stays `user`: it only works at difference 0, and undo is the sanctioned `admin` way out of the lock it creates. The locks (`TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`) are 409s checked after the role 403, so no role bypasses them, `admin` and `owner` included |
| Ownership | Statements inherit the owner through their account and never store an owner column. Every route resolves the account owner-scoped first: a uniform 404 for a foreign, wrong-context or non-member id, and global `is_admin` gets no bypass. Every statement lookup is by `{ id, accountId }` (the path account), so a statement of a sibling account of the same owner, or of another context, answers the same 404 as an unknown id, never a 409. A ticks body may only name transactions of the same account: the ids (`tick` and `untick` alike) are loaded in a single account-scoped query (`WHERE id IN (…) AND account_id = :account`), and any miss answers 404 and rejects the whole batch, applying nothing. A foreign and a nonexistent id are indistinguishable, and no 404 or 409 message names an id. The service also keeps the invariant that a tick always links a row to a statement of the row's own account |
| Response fields | Every new field is derived from the caller's own, already owner-scoped account and carries no owner, user or member field. It never points to another account's statement. The statement response, the history rows (`undoable`, `transaction_count`) and the account `last_reconciliation` and `open_reconciliation_id` come from the path account. The ledger-row `reconciliation` (`{ id, status, statement_date }`) comes from a `LEFT JOIN` on `r.id = t.reconciliation_id AND r.account_id = t.account_id`, and the cleared-balance `SUM` is scoped the same way. The ledger envelope's `last_reconciled_date` is queried by the scoped account id. The transaction POST and PATCH responses gain `reconciliation` too, through an account-scoped lookup |
| Account payload | `last_reconciliation` and `open_reconciliation_id` are on the account **detail only**, not on the list. No list UI reads them, and `statement_balance` is financial data that nothing on the list needs. If a later list badge needs them (see Open concerns), the list may add them with a query grouped over the owner-scoped account ids only |
| Data sensitivity | Statement balances are financial data. Bodies are never logged, and TypeORM query or parameter logging must stay off on these routes. Statement responses never contain owner fields. All new 409 messages are fixed static text: they never carry `statement_balance`, `difference`, `ticked_sum`, `cleared_balance`, the latest finished date, a statement or transaction id, or a count. The client already has these values from the statement response. 400 messages never echo the offending value |
| Input bounds | See [Input bounds](#input-bounds) below |
| Concurrency | See [Concurrency](#concurrency) below |
| Cache | No route is `public`. GETs are `user-scoped`, writes are `never` with `InvalidatesOwner()`. Navi warms nothing. 400 and 409 bodies are never cached |
| Memory and module | Owned by the lazy `bank` module. It adds no dependency and no always-on code beyond one resident controller. The difference is a single `SUM` query, not in-memory work, so it fits the 512 MB Render tier |

### Input bounds

- **Ticks body** (`tick` and `untick`): reuses the `MarkChargesDto` pattern
  (`backend/src/bank/dto/mark-charges.dto.ts`): `@IsArray()`, `@ArrayMaxSize(50)`, and
  `@IsInt({ each })`, `@Min(1, { each })`, `@Max(MAX_ID, { each })`. Each array is optional and
  defaults to `[]`. "Validated like `parseId`" means the same numeric range (1 to 2147483647), but
  a malformed id inside the body is a **400** through `@StrictBody()`, not `parseId`'s 404. A
  non-array or non-integer value, and any extra field, is a 400.
  - **Duplicates** inside one array are accepted and de-duplicated by the service (the same
    precedent as `mark-charges.dto.ts`). The cap of 50 applies to the raw array length, before
    de-duplication.
  - `tick` and `untick` must be disjoint, checked after de-duplication, and at least one must be
    non-empty after it. Both violations are a 400 with a fixed message.
  - `untick` only affects rows linked to **this** open statement. An id that is unlinked, or
    linked to a finished statement, is a no-op, so an untick can never unclear a cleared row.
- **Statement date** (POST and PATCH): reuses `IsLedgerDate` / `isAllowedLedgerDate`
  (`backend/src/bank/ledger-date.ts`), the one upper-bound rule in the code: a real calendar day,
  at most **UTC today + 1 day**. A date beyond that is a 400. The UI `max` of today is a UX
  default only: the server is the authority, so nobody should align the backend to today.
  - The lower bound `statement_date >= opening_date` (inclusive) is a 400 in the
    account-dependent step, with a fixed message that echoes no value.
  - The chronology rule, strictly after the latest finished `statement_date`, is a 409
    `RECONCILIATION_OUT_OF_ORDER`. A date that breaks both rules answers the 400 first. On PATCH
    of an open statement the comparison is against finished statements only.
- **Statement balance**: a signed decimal string, parsed with
  `parseAmountInput('statement_balance', value, account.currency)` and no `nonZero` option. The
  bound is `|value| <= 10¹³` minor units on the **absolute value**. Negative values are allowed
  (overdrafts and debts, signed like the ledger), and so is zero (a zero-row statement). The
  decimal places must match the currency exponent, and strings over 32 characters are rejected.
  The DTO only declares `@IsString()` (like `CreateTransactionDto`): the service parses it
  against the account's currency, so a bad amount is an account-dependent 400. `difference` is
  computed as a `BigInt` from the `SUM` string, never a `Number`.
- **Mass assignment**: `account_id`, `status`, `reconciled_at`, `reconciliation_id` and
  `reconciliation` in any body answer 400 (`@StrictBody()` whitelist).

### Concurrency

Every reconciliation write, the account PATCH, archive and delete, the transaction PATCH and
DELETE, and the three payment undos run in one DB transaction with the same fixed lock order, so
there is no deadlock between them:

1. the account row, `SELECT … FOR UPDATE` (re-read inside the transaction, `archivedAt`
   rechecked there, and a missing row answers the uniform 404);
2. the statement row, `FOR UPDATE`;
3. the transaction rows, `FOR UPDATE` in ascending id order (including the several rows that
   `undoPayment()` removes).

`TransactionService.update()` and `delete()` therefore take the account lock first, and the
auto-untick rule reads the open statement under it. An unexpected `ER_LOCK_DEADLOCK` maps to a
uniform 409 retry-style error with fixed text, never a 500 carrying detail.

- **Two concurrent starts.** The loser hits `ER_DUP_ENTRY` on the unique `open_key`. It is mapped
  with `isMysqlError(error, MYSQL_DUPLICATE_ENTRY)`, catching around the whole
  `manager.transaction` as in `bill-payment.writer.ts`, to 409 `RECONCILIATION_OPEN`, never a 500.
  A pre-check keeps the friendly path.
- **Undo vs. start.** The account lock serialises them, and the loser answers 409
  `RECONCILIATION_OPEN`. A duplicate raised by undo's `reconciled_at = NULL` update maps the same
  way.
- **Tick vs. transaction PATCH or DELETE.** `TransactionService.update()` and `delete()` lock the
  row (`pessimistic_write`) inside a transaction and check `reconciliationId` on current data.
  PATCH first: the tick then sees the new date and answers 409 `TRANSACTION_NOT_ELIGIBLE`. Tick
  first: the PATCH sees a ticked, not cleared, row and succeeds (with the auto-untick rule).
  DELETE first: the tick batch answers 404 and rolls back whole. Eligibility is rechecked under
  the row locks.
- **Finish vs. tick, and finish vs. PATCH or DELETE of a ticked row.** Finish locks the statement
  and then the ticked rows, recomputes the difference under the lock, and sets `reconciled_at`
  with `UPDATE … WHERE reconciled_at IS NULL`, checking the affected rows. A tick after finish
  answers 409 `RECONCILIATION_FINISHED`.
- **Payment undo vs. finish.** `bill-payment-undo.ts` rechecks `TRANSACTION_CLEARED` under the
  same row locks before `BillPaymentWriter.remove()`.
- **Account PATCH (`opening_*`, currency) and archive vs. start or tick.** They take the account
  lock and recheck "a statement exists" inside it.

### Security review (#153)

The new routes and every new 409 path were reviewed. All are `@OwnerScopedController('bank')`,
the role is never taken from input, and the role split fails closed. The check order of
[api/reconciliations.md](api/reconciliations.md#check-order) places every 409 after the 404 and
403, so a non-member never learns a statement's state. Findings applied above and in
[api/existing-routes.md](api/existing-routes.md): the ledger join scope, the account-scoped
ticks lookup, the absolute balance bound, the single date rule, the duplicate-id rule, the lock
order, the `open_key` mapping, the fixed 409 messages, and the anchor and currency lock now
starting as soon as a statement exists, open or finished. The audit log, which matters once
members can join an organization (#82), stays in
[Future epics](README.md#future-epics).

## Open concerns

Still deferred to later spec-enhancement issues. Each has a recommended default, **provisional —
to be settled in its issue**. Roles, security and data access were settled by #153 (see
[Decided](#decided)).

- **Backward compatibility and migration** (#154). The change is additive with no backfill (see
  [model.md](model.md#migration)). The only behaviour change for existing users is the anchor
  and currency lock, and it starts only after their first statement.
- **Performance** (#154). Indexes on `(reconciliation_id)` and `(account_id, statement_date)`.
  The ledger `LEFT JOIN` adds one indexed lookup per row. The worst case of the cleared-balance
  `SUM` is the account's whole ledger, the same as `currentBalance()`.
- **Mismatch surfacing beyond the difference bar and the badge** (#155). Recommend none in this
  epic: no notifications and no account-list badge.
- **Checkpoint anchors as an alternative** (#155; each finished statement becomes a new anchor
  for balances). Recommend rejecting it, since it would change the computed balance model. Keep
  it listed for the enhancement phase to confirm.

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Organizations](https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth/organizations.md)
- [Caching](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)

## Required tests

- A foreign, wrong-context or non-member account id answers a uniform 404 on every route, for
  both base paths, and global `is_admin` gets no bypass.
- A statement id of a sibling account of the same owner, and of the other context, answers 404
  (not 409) on GET, PATCH, DELETE, ticks, finish and undo.
- A ticks body naming a transaction of another account, in `tick` or in `untick`, answers 404
  and changes nothing, even when mixed with eligible ids.
- Ticks arrays above 50 raw ids, overlapping `tick` and `untick`, empty bodies, a non-integer or
  out-of-range id, an extra field, and `account_id`, `status`, `reconciled_at`,
  `reconciliation_id` or `reconciliation` in a body answer 400. Duplicates in one array are
  accepted and de-duplicated. An untick of a cleared or unlinked row is a no-op.
- Dates: today + 1 day is accepted and the day after answers 400, on POST and PATCH. A date
  before `opening_date` answers 400, and a date that also breaks the chronology answers 400
  first.
- Balances: a negative balance within the bound and zero are accepted. An absolute value above
  10¹³ minor units, either sign, and a wrong number of decimals answer 400.
- A `user` sending an invalid body to cancel or undo gets 403 (403 before 400, under the org
  base path), and a non-member gets 404.
- Two concurrent starts: one 201 and one 409 `RECONCILIATION_OPEN`, never 500. A concurrent
  tick and transaction PATCH or DELETE (including a PATCH that moves the date), a finish and
  tick, and a finish and a payment undo, end in the outcomes listed under
  [Concurrency](#concurrency).
- No 409 or 400 body contains a balance, difference, date, id or count.
- Every GET sends `X-Cache-Allow` as user-scoped and every write sends `X-Skip-Cache`.

Back to the [README](README.md).
