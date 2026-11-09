# e2e and integration specs
Cover the spec's backend *Required tests* for Transactions, Hand-off preview and Mark sent /
unsent.

## e2e
Write `tests/accountant.e2e-spec.ts` following `provider-expense-accounts.e2e-spec.ts`:
- swap in the in-memory query with `jest.mock('../accountant-charges.query.js', ...)`;
- run every case in both contexts: `CONTEXTS` Personal / organization;
- use `NOT_FOUND_CASES` / `ownerKeysIn` from `support/owner-matrix.ts`.

### Preview
- **Content.** Only charges of `for_accountant` provider accounts of the active owner, with
  archived accounts and charges before `opening_date` included. Ordered by date, then id.
- **`include_sent`.** Sent charges are excluded by default and included with
  `include_sent=true`.
- **Shape.** The `{ charges }` envelope with the nested five-field `account` and no owner fields.
  An empty range answers `[]`.
- **Validation errors (`400`).**
  - missing or invalid `from` / `to`;
  - a date after today + 1;
  - `from > to`;
  - a range over 366 days;
  - `include_sent=1`;
  - a repeated parameter;
  - more than 1000 rows.
- **Accepted ranges.** `from == to` and exactly 366 days are accepted.
- **Unknown parameters.** Ignored.
- **Cache class.** The `X-Skip-Cache` / cache-class header matches the user-scoped class.

### Mark sent / unsent
- **Stamping.** Charges are stamped. A re-mark keeps the original timestamp. Duplicates are
  de-duplicated in the reply.
- **`404`.** Another owner's id, or the wrong context. A mixed 404 + 400 request answers `404`.
- **`400`, with the rejected ids in the message.** Payments, other account types, and
  `for_accountant`-off charges on `mark-sent`.
- **Un-marking.** `mark-unsent` clears the mark on a `for_accountant`-off charge.
- **All-or-nothing.** Nothing changes on an error.
- **Body validation (`400`).** An empty list, more than 1000 ids, a non-integer or `0` id, an
  extra body field.
- **Archived accounts.** Marking works, while transaction create / edit / delete there stay
  `409`.
- **Cache class.** `never`.

### Transactions
- **Key presence.** `sent_to_accountant_at` appears on provider charges in the ledger and in
  `POST` / `PATCH` responses. It is absent on provider payments, on the opening row and on other
  account types.
- **Sign flip.** A `PATCH` flipping the sign clears the mark.
- **Generic body.** A transaction body with `sent_to_accountant_at` → `400`.
- **Regression.** Existing regular, debt and investment specs pass unchanged.

## Integration
Add `src/bank/tests/integration/accountant-charges.integration-spec.ts` (or the folder where
`ledger.integration-spec.ts` lives). It runs the real SQL against MySQL:
- the preview filters, ordering and `LIMIT`;
- `resolveForUpdate` with `FOR UPDATE OF t` inside a transaction;
- stamp keeping the existing timestamps, and clear.

Also extend `ledger.integration-spec.ts` to check that the new column is selected.

## Files to Change
- `backend/src/bank/tests/accountant.e2e-spec.ts` — new e2e spec
- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts` — transaction-response / sign-flip cases, if they fit better here
- `backend/src/database/tests/integration/accountant-charges.integration-spec.ts` — real SQL coverage (place it next to `ledger.integration-spec.ts`)
- `backend/src/database/tests/integration/ledger.integration-spec.ts` — the new column in ledger rows
