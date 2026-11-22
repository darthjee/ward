# Changes to existing routes

Write `docs/agents/specs/reconciliation/api/existing-routes.md`: every change reconciliation
makes to routes that already exist. Each change names the service it lands in (from the
backend exploration), so the implementation issue knows where to work.

- **Transaction PATCH** (`backend/src/bank/transaction.service.ts` `update()`, after
  `#findTransaction`): when the row is cleared, a body whose `amount` or `date` differs from
  the stored value → 409 `TRANSACTION_CLEARED`. An unchanged value, `description` and `notes`
  pass. Order: 404, 400, `ACCOUNT_ARCHIVED`, the payment-generated 403, then
  `TRANSACTION_CLEARED`. A PATCH that moves a **ticked** row's date past the open statement's
  `statementDate` unticks it.
- **Transaction DELETE** (`delete()`): cleared → 409 `TRANSACTION_CLEARED`. Deleting a ticked
  row is allowed.
- **Transaction responses and ledger rows** gain `reconciliation`: `null` (uncleared), or
  `{ id, status: 'open' | 'finished', statement_date }`. Like `payment_generated`, it is
  computed inside the ledger query (`backend/src/bank/ledger.query.ts`) with a `LEFT JOIN`
  (no query per row). The virtual `opening` row never carries it.
- **Ledger envelope** gains `last_reconciled_date` (the latest finished `statement_date`, or
  `null`). The frontend uses it for the warning badge: an uncleared row dated ≤ that date.
- **Account response** (detail and list) gains `last_reconciliation`:
  `{ statement_date, statement_balance, reconciled_at } | null`, and
  `open_reconciliation_id: number | null`. On the list they come from one grouped query with
  no N+1, the same rule as balances. Note as provisional (step 06) whether the list really
  needs them or only the detail does.
- **Account PATCH** (`backend/src/bank/account.service.ts` `update()`): when any finished
  statement exists, an `opening_date` or `opening_balance` that differs from the stored value →
  409 `ACCOUNT_RECONCILED`. Model it on the `CURRENCY_LOCKED` check in `#applyCurrency`.
- **Account DELETE** — unchanged. It needs no transactions, so a cascade only ever removes
  zero-row statements.
- **Bill payment undo** — all three undo routes (debt occurrence, one-off `bills/:id/payment`,
  provider-bill occurrence) go through `undoPayment()` (`bill-payment-undo.ts`) and then
  `BillPaymentWriter.remove()`. Block there, in one place: if any linked payment, withdrawal or
  charge transaction is cleared → 409 `TRANSACTION_CLEARED`. If a linked transaction is only
  ticked, the undo deletes it and the tick goes with it.
- **Bill / provider-bill DELETE** — already 409 when paid (`PROVIDER_BILL_PAID` etc.). No
  change, since a paid bill is the only way to have generated transactions. Record this so
  nobody adds a redundant check.
- **Accountant hand-off** — no interaction with `sentToAccountantAt` (record this explicitly).
- Add the new error codes to the error-code table of each affected route section.

**Required tests** — extend `transactions.e2e-spec.ts` (changed vs unchanged amount/date,
description edit, delete, admin gets no bypass), `accounts.e2e-spec.ts` (anchor lock before and
after undo), the bill-payment e2e specs (undo blocked when cleared, allowed when ticked), and
the ledger query units (the `reconciliation` field and `last_reconciled_date`).

## Files to Change
- `docs/agents/specs/reconciliation/api/existing-routes.md` — new; deltas to transactions, ledger, accounts and bill-payment routes.
