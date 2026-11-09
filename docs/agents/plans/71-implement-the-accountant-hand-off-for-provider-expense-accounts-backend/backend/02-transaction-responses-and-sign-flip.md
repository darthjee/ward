# Expose `sent_to_accountant_at` on transaction responses and clear it on a sign flip
Ledger rows and the `POST` / `PATCH` transaction responses carry `sent_to_accountant_at`
**only** when the account type is `provider_expense` **and** the amount is negative. The value
is the ISO timestamp, or `null` when unsent. On payments and on every row of regular, debt and
investment accounts the key is **absent** (not `null`), so their responses stay byte-identical.
The virtual opening row never carries it.

- **`ledger.query.ts`.** Always select `t.sent_to_accountant_at`, in both the inner and the outer
  `SELECT` of `LEDGER_PAGE_SQL`. Add it to `RawLedgerRow` / `LedgerRow` and to the mapping in
  `page()`. There is no per-type SQL and no extra query.
- **`tests/support/in-memory-ledger.query.ts`.** Carry the field the same way.
- **`transaction-response.ts`.**
  - `serializeTransaction(transaction, currency)` only receives the currency today. Change it to
    receive the `Account` (it needs `type` and `currency`) and update its callers in
    `TransactionService.create` / `update`.
  - `serializeLedger(account, ...)` already has the account. Add the key to the rows using one
    shared helper, e.g. `handOffMark(account, amount, sentAt)`, which returns
    `{ sent_to_accountant_at }` or `{}`.
  - Extend the `TransactionResponse` / `LedgerRowResponse` types with an optional key.
- **`TransactionService.update` sign flip.** After the amount is re-parsed:
  - if the account is `provider_expense` and the new amount is positive (it became a payment),
    set `transaction.sentToAccountantAt = null`;
  - flipping it back yields an unsent charge;
  - any other edit keeps the mark.
- **Generic transaction body.** It keeps rejecting `sent_to_accountant_at` (`400`) through
  `@StrictBody()`. No DTO change is needed, but add a spec asserting it.
- **Archived accounts.** Create / edit / delete there still answer `409` (unchanged).

Unit specs:
- `transaction-response.spec.ts`: the key is present for a provider charge (both `null` and a
  timestamp), and absent for a provider payment, for other account types, and on the opening
  row.
- `transaction.service.spec.ts`: a sign flip clears the mark, a flip back stays unsent, and any
  other edit keeps it.
- `ledger.query` spec, if one exists: the field is mapped.

## Files to Change
- `backend/src/bank/ledger.query.ts` — select and map `sent_to_accountant_at`
- `backend/src/bank/tests/support/in-memory-ledger.query.ts` — carry the field
- `backend/src/bank/transaction-response.ts` — conditional key, and the new `serializeTransaction` signature
- `backend/src/bank/transaction.service.ts` — pass the account to the serializer; clear the mark on a sign flip
- `backend/src/bank/tests/transaction-response.spec.ts` — key presence / absence cases
- `backend/src/bank/tests/transaction.service.spec.ts` — sign-flip cases
