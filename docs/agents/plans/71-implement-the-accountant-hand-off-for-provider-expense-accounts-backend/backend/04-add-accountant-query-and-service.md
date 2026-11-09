# Add the charges query and `AccountantService`

## `accountant-charges.query.ts`
An injectable class next to `ledger.query.ts`. It holds the raw SQL, with `?` parameters and the
owner filter written as SQL that mirrors `accountOwnerWhere`:
`a.user_id = ? AND a.organization_id IS NULL`, or `a.user_id IS NULL AND a.organization_id = ?`.

### `preview(owner, from, to, includeSent)`
- Joins `bank_transactions t`, `bank_accounts a` and `bank_provider_expense_details d`.
- Filters on:
  - the active owner;
  - `a.type = 'provider_expense'`;
  - `d.for_accountant = 1`;
  - `t.amount < 0`;
  - `t.date BETWEEN from AND to`;
  - unless `includeSent`, `t.sent_to_accountant_at IS NULL`.
- Archived accounts are included. Charges before `opening_date` are included.
- Order by `t.date, t.id`, `LIMIT 1001`.
- Select `t.id`, the formatted date, `t.description`, `t.amount`, `t.sent_to_accountant_at`,
  `a.id`, `a.name`, `a.bank_name`, `d.provider_tax_id` and `a.currency`.

### `resolveForUpdate(manager, owner, ids)`
- One owner-scoped query: `SELECT t.id, t.amount, t.sent_to_accountant_at, a.type, d.for_accountant FROM bank_transactions t JOIN bank_accounts a … LEFT JOIN bank_provider_expense_details d … WHERE t.id IN (?) AND <owner> FOR UPDATE OF t`.
- It locks only `bank_transactions` rows. The accounts and details are not locked.

### `stamp(manager, ids, now)` and `clear(manager, ids)`
- Stamp: `UPDATE bank_transactions SET sent_to_accountant_at = ? WHERE id IN (?) AND sent_to_accountant_at IS NULL`.
  This keeps the original timestamp on re-marks.
- Clear: `UPDATE … SET sent_to_accountant_at = NULL WHERE id IN (?)`.

## `accountant.service.ts` — `AccountantService` (lazy)

### `preview(owner, query)`
1. Apply the range rules from step 03.
2. Run the query. More than 1000 rows → `400` ("narrow the range").
3. Serialize to `{ charges: [...] }`, each row carrying `id`, `date`, `description`, `amount`
   (formatted with the account currency's exponent, using the same amount formatter as
   `transaction-response.ts`), `sent_to_accountant_at` (ISO or `null`) and
   `account: { id, name, bank_name, provider_tax_id, currency }`.
4. Only those five account fields: no owner fields, no `account_number`, no balance. An empty
   range answers `{ charges: [] }`.

### `markSent(owner, dto)` / `markUnsent(owner, dto)`
1. De-duplicate the ids.
2. Inside `transactionRepository.manager.transaction(async (manager) => …)`, resolve them with
   `resolveForUpdate`.
3. Classify the rows:
   - **Any id unresolved** (unknown, another owner's, wrong context) → `404`, through
     `ownerNotFound()`. This check comes first, so a mix of 404 and 400 ids answers `404`.
   - **`mark-sent` → `400`** for a payment, a non-provider account, or a provider charge whose
     `for_accountant` is off.
   - **`mark-unsent` → `400`** for a payment or a non-provider account only. Charges with
     `for_accountant` off can still be un-marked.
   - **400 message.** The `BadRequestException` message names the rejected ids, e.g.
     "transactions 7, 9 are not hand-off charges". Only the owner's own ids appear in it.
4. On success, run a single `UPDATE` (stamp or clear).
5. Reply `{ charges: [{ id, sent_to_accountant_at }] }` for every posted id after
   de-duplication:
   - `mark-sent` reports the original timestamp when a charge was already sent, otherwise `now`;
   - `mark-unsent` reports `null`.
6. Archived accounts are allowed. Nothing is written on any error (all-or-nothing).

## Unit spec
`tests/accountant.service.spec.ts`, with a `jest.fn()` manager / query, covers:
- classification and precedence;
- de-duplication;
- the idempotent re-mark keeping the original timestamp;
- an unsent no-op;
- an assertion that the resolve SQL contains `FOR UPDATE OF t` and runs inside the transaction;
- the preview cap and the range errors.

Keep each file under 300 lines and functions under complexity 10. Split the classification into
a helper if needed.

## Files to Change
- `backend/src/bank/accountant-charges.query.ts` — new raw SQL class
- `backend/src/bank/accountant.service.ts` — new lazy service
- `backend/src/bank/tests/accountant.service.spec.ts` — unit spec
- `backend/src/bank/tests/support/in-memory-accountant-charges.query.ts` — in-memory twin for e2e (preview, resolve, stamp, clear over the in-memory repos)
