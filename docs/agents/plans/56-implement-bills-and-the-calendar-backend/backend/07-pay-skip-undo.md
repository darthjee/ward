# Pay, skip and undo

Add these routes:

- `POST` / `DELETE <base>/accounts/:accountId/occurrences/:dueDate/payment.json` (derived occurrences);
- `POST` / `DELETE <base>/bills/:id/payment.json` (one-off bills).

All of them are `never`.

- **POST** → `@HttpCode(201)`, with the updated occurrence in the occurrence shape (the serializer from step 05).
- **DELETE** → `@HttpCode(204)`.

## Path resolution (404, never 403)

- **`:accountId`.** `parseId`, then an owned account of type `debt` or `provider_expense`; otherwise `ownerNotFound()`.
- **`:dueDate`.** Must be a valid `YYYY-MM-DD` (`isIsoDate`), otherwise 404. It must also be a nominal occurrence of the account's current schedule, checked with `isNominalOccurrence` (step 04). That check covers:
  - `dueDay` set;
  - `show_in_calendar`;
  - not archived;
  - on or after `bills_from`;
  - matching the day / month after clamping.

  Otherwise 404.
- **`:id` (bill).** An owned bill whose provider is not archived; otherwise 404.

## Payment body

Add `bank/dto/pay-occurrence.dto.ts`, used with `@StrictBody()`:

- `status` is `paid` | `skipped`.
- **For `paid`:**
  - `paid_on` is required: an ISO date, at most UTC today + 1 (`isAllowedLedgerDate` / `IsLedgerDate`);
  - `amount` is required: parsed with `parseAmountInput` in the source currency, must be > 0 and within bounds;
  - `paying_account_id` is required;
  - `record_charge` is an optional boolean, default `true`.
- **For `skipped`:** no other field is accepted → 400.
- **`record_charge` on a debt occurrence** → 400.

The whitelist is static, so these conditional checks live in a small pure validator (`bills/payment-body.ts`). It gets the occurrence kind and returns a normalised command.

## Service

Add `BillPaymentService` (`bank/bills/bill-payment.service.ts`, exposed in the loader).

### Pay

1. **Resolve.** Resolve the occurrence (as above). For `paid`, resolve the paying account with `PayingAccountResolver` against the source currency: 422 "account not found" or 422 "currency mismatch".
2. **Duplicate check.** If a payment row already exists for this key, answer 409, via a new `occurrenceAlreadyPaid()` helper and `ErrorCodes` entry.
3. **Write atomically.** In **one** `manager.transaction(async manager => …)`:
   - for `paid`, insert the ledger transactions:
     - `+amount` on the source account (the payment);
     - `-amount` on the paying account (the withdrawal);
     - for a provider with `record_charge`, also `-amount` on the provider (the charge), with `sentToAccountantAt: null`. It feeds the hand-off with no extra code;
   - date the transactions `paid_on`;
   - describe them as `"<bill description | account name> — <nominal due date>"`, truncated to 255 code points;
   - insert the `bank_bill_payments` row with `status`, `paid_on`, `amount`, `paying_account_id` and the three transaction ids. A skip writes only the row.
4. **Race-safe 409.** Map `MYSQL_DUPLICATE_ENTRY` raised inside the transaction to the same 409.
5. **Response.** Re-read the occurrence and serialize it.

**Transaction creation.** Reuse the creation logic of `TransactionService` where it is accessible, or build the entities directly with `manager.create(Transaction, …)`. Keep one place for the transaction-row construction, extracted into a helper if needed. The archived and ledger checks are already covered by the path and paying-account resolution.

### Undo

1. **Locate.**
   - Resolve the path as above.
   - Load the payment row. None → 404.
2. **Archived accounts** (decided in #56):
   - Paid payment whose source account is archived → 409 `accountArchived()`. The derived-path 404 for archived accounts must not pre-empt this, so the undo path checks ownership, type and payment existence before the schedule and archived checks.
   - Paid payment whose paying account is archived → 409.
   - Skip whose source account is archived → 404.
   - One-off whose provider is archived → 404.

   Write the order of these checks down as a table in the service and cover each case with a spec.
3. **Delete atomically.** In one DB transaction:
   - delete the linked transactions **that still exist** (`findBy({ id: In(ids) })`), including a charge already sent to the accountant;
   - then delete the payment row.

   The occurrence becomes open or overdue again.

## Controller

Add the four handlers to a new `bank/bill-payments.controller.ts`, or to `calendar.controller.ts` / `bills.controller.ts` if each stays under 300 lines. The handlers are thin and delegate to the service.

## Tests

- **Pay a debt occurrence:** `+` on the debt and `−` on the paying account, dated `paid_on`, with the description text (and its truncation).
- **Pay a provider occurrence and a one-off bill,** with and without `record_charge`. The charge shows up in the accountant hand-off preview (`accountant.e2e-spec` style).
- **Atomic rollback:**
  - a unit spec with a fake `EntityManager` that throws on the Nth write, asserting nothing is persisted or returned;
  - a MySQL integration spec (`bill-payments.integration-spec.ts`) forcing a failure, e.g. a duplicate key on the payment row after the transactions are inserted, asserting that no transaction rows remain.
- **Skip:** writes no transactions; the occurrence is neither open nor overdue.
- **Undo:**
  - removes the row and only the transactions that still exist (one deleted by hand first);
  - the occurrence becomes open or overdue again;
  - undo with no payment → 404;
  - the archived-account matrix above.
- **Errors:**
  - paying twice → 409;
  - non-occurrence dates → 404 (off-schedule, before `bills_from`, hidden, archived, malformed);
  - body whitelist 400s (unknown field, extra fields on a skip, `record_charge` on a debt);
  - `paid_on` after today + 1 → 400;
  - the 422 matrix with identical bodies, and the currency mismatch.
- **Owner matrix** on all four routes; no owner keys in responses.

## Files to Change

- `backend/src/bank/dto/pay-occurrence.dto.ts`, `backend/src/bank/bills/payment-body.ts` — the body and its conditional rules
- `backend/src/bank/bills/bill-payment.service.ts` — pay, skip and undo, atomically
- `backend/src/bank/bills/payment-description.ts` (or similar) — description text and code-point truncation
- `backend/src/bank/account-conflicts.ts`, `backend/src/core/error-codes.ts` — the `occurrenceAlreadyPaid` 409
- `backend/src/bank/bill-payments.controller.ts` — the routes
- `backend/src/bank/bank-routes.module.ts`, `bank.module.ts`, `bank-module.loader.ts` — registration
- `backend/src/bank/tests/bill-payment*.spec.ts`, `bill-payments.e2e-spec.ts` — tests
- `backend/src/database/tests/integration/bill-payments.integration-spec.ts` — the real rollback
