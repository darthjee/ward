# Data model and lock rules

Write `docs/agents/specs/reconciliation/model.md`: the new entity, the change to
`Transaction`, the balance formulas, the statement lifecycle, and the lock matrix.

**`Reconciliation` entity** (`bank_reconciliations`, entity file
`backend/src/bank/entities/reconciliation.entity.ts`). Follow the plain-column style of the
`BillPayment` entity (`bill-payment.entity.ts`): no TypeORM relations, real FKs declared in
the migration.

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `accountId` | int, FK `bank_accounts.id` `ON DELETE CASCADE` | Inherits the owner through the account, never stores one. Cascade lets an account with no transactions but with a zero-row statement still be hard-deleted |
| `statementDate` | `DATE` | ≥ `openingDate`, ≤ UTC today + 1 day, strictly after the latest finished statement's date |
| `statementBalance` | `BIGINT` minor units | In the account currency; decimal string in the API, same bound (10¹³) as amounts |
| `reconciledAt` | nullable `DATETIME` | `NULL` = `open`, set = `finished`; undo sets it back to `NULL` |
| `createdAt` / `updatedAt` | | |

- **State is derived from `reconciledAt`**, so there is no separate status column. Record why:
  undo is a pure state change, and two columns that could disagree are avoided. (`BillPayment`
  uses a `status` varchar because its two states carry different columns. This entity does
  not.) The API still exposes `status: 'open' | 'finished'`.
- **One open statement per account, enforced in the DB** — a generated column
  `open_key = IF(reconciled_at IS NULL, account_id, NULL)` with a unique index. This mirrors
  `active_name_key` in [accounts.md](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/accounts.md#name-uniqueness).
  Starting a second statement races into the index and answers 409 `RECONCILIATION_OPEN`.
- **Index** `(account_id, statement_date)` serves the latest finished lookup, the history
  order, and the chronology check.

**`Transaction` change** — a new nullable `reconciliationId` (`reconciliation_id`), FK to
`bank_reconciliations.id` `ON DELETE SET NULL` (cancelling an open statement drops its ticks),
plus an index `(reconciliation_id)`.

- **Ticked** — the row is linked to the account's `open` statement.
- **Cleared** — the row is linked to a `finished` statement.
- **Uncleared** — the column is `NULL`.
- The column is never accepted in a transaction body (it joins the list of fields that answer
  400).

**Eligibility to tick** — the row belongs to the statement's account, is dated ≥
`openingDate` and ≤ `statementDate`, and is not cleared by another statement. Moving
`statementDate` earlier unlinks the ticked rows that now fall after it, in the same DB
transaction.

**Formulas** (computed, never stored):

- *cleared balance* = `openingBalance` + SUM(amount of rows dated ≥ `openingDate` linked to
  any finished statement of the account);
- *ticked sum* = SUM(amount of rows linked to the open statement);
- *difference* = `statementBalance` − (cleared balance + ticked sum).

The query goes in `AccountBalancesQuery` (`backend/src/bank/account-balances.query.ts`), next
to `currentBalance()`, with a join on `bank_reconciliations`.

**Debt sign** — `statementBalance` is stored signed like the ledger. On a debt the statement
shows the positive amount owed, so the UI negates it (as it does for the opening balance) and
the API always takes and returns the signed value.

**Lifecycle table** — start, edit while open, tick / untick, finish, undo, cancel. For each,
list the preconditions and the error code from the issue. Record "Editing a finished statement
is not allowed: undo it first" and "Undo keeps the ticks".

**Lock matrix** (rows: open-ticked, cleared, uncleared; columns: PATCH amount/date, PATCH
description/notes, DELETE, undo/delete of the generating bill payment):

- cleared rows: amount/date → 409 `TRANSACTION_CLEARED` only if the value actually changes
  (sending the unchanged value is accepted); description/notes allowed; DELETE → 409; the
  generating bill payment cannot be undone or deleted → 409 `TRANSACTION_CLEARED`;
- open-ticked and uncleared rows: everything allowed. A delete of a ticked row simply drops
  the tick, and an edit that moves a ticked row's date past `statementDate` unticks it (record
  this edge case);
- no role bypass.

**Migration** — one additive migration: create the table, add the column with its FK and
index, no backfill. Name: `backend/src/database/migrations/<YYYYMMDD>120027-bank-create-reconciliations.ts`
(the sequence counter continues after `20261120120026-bank-contract-provider-bills.ts`). It is
backward compatible: every existing row starts uncleared and every current rule keeps working.
The rollback drops the column and then the table.

**Required tests** — unique-open index integration spec (`database/tests/integration/`),
migration up/down spec, formula units (anchor, rows before the anchor excluded, debt sign,
zero-row statement), eligibility and auto-untick units.

## Files to Change
- `docs/agents/specs/reconciliation/model.md` — new; entity, FK, states, formulas, lifecycle, lock matrix, migration.
