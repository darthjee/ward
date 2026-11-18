# Provider-bill service and shared bill logic

## Generalise the shared one-off logic

Extract the one-off logic shared with `BillService` (amount parsing, paying-account
application, payment lookup, move rules) out of `bill.service.ts`. Parameterise it by `kind` and
by the conflict and not-found factories, so `bills.json` and `provider-bills` run the same code.
`bill.service.ts` stays under 300 lines.

- `list`, `findOwned` and `#lockedBill` keep `kind: 'one_off'` for `bills.json`. The value comes
  from a parameter or constant, not a literal in three places. `bill-payment.service.ts` keeps
  calling `findOwned` with one-off semantics.
- A new shared helper `paidPaymentExists(manager, bill)` checks `status = 'paid'` rows:
  - one-off bills: by `billId`;
  - recurring bills: by `providerBillId`, over all rows (not `findOneBy({ billId })`).

## Add `ProviderBillService`

Add `ProviderBillService` (`backend/src/bank/provider-bill.service.ts`, new; split into helpers if
it nears 300 lines). Every write runs in a transaction.

### `list(owner, accountId, kind, page)`

- Resolve the provider through `ProviderBillResolver.provider(..., { allowArchived: true })`.
- `kind` is an allowlist: an unknown value returns `{ provider_bills: [], pagination }`.
- `LEDGER_PER_PAGE` is 50. The ordering puts recurring bills first, by `description`, then
  one-offs by `due_date DESC, id DESC`. Use two queries and do the offset arithmetic:
  1. Load all recurring bills (at most 50) and sort them by description.
  2. `offset = (page - 1) * 50`.
  3. Slice the recurring list.
  4. Run `findAndCount` for one-offs with `skip = max(0, offset - R)` and
     `take = 50 - recurringSliceLength`.
  5. The total is `R + oneOffCount`.

  This works with the in-memory repo, which has no query builder.

### `create(owner, accountId, dto)`

1. Resolve the provider (not archived, otherwise `409 ACCOUNT_ARCHIVED`).
2. Build the fields through `provider-bill-fields.ts`, parsing `expected_amount` in the provider
   currency.
3. Resolve `paying_account_id` with `PayingAccountResolver.resolve(owner, id, provider.currency,
   manager)`.
4. For **recurring** bills:
   1. Lock the provider `Account` row `pessimistic_write`.
   2. Load the recurring bills.
   3. With 50 or more, raise `409 PROVIDER_BILL_LIMIT`.
   4. If `sameDescription` matches an existing bill, raise `409 PROVIDER_BILL_NAME_TAKEN`.
5. Save inside `mapProviderBillNameClash`.

### `find(owner, id)`

Resolve the bill and serialize it.

### `update(owner, id, dto)`

1. Resolve the bill, locked.
2. If `dto.kind` differs from the stored kind, raise `409 KIND_LOCKED`.
3. If `dto.provider_account_id` differs on a recurring bill, raise `409 PROVIDER_LOCKED`. This
   check runs **before** any target resolution.
4. For a one-off move, apply the shared move rules from `backend.md` decision 5 with
   provider-bills codes, then re-check `paying_account_id` against the target.
5. Validate the merged state.
6. For a recurring rename, lock the provider row and re-check the name with `sameDescription`,
   excluding the bill's own id.
7. Save inside `mapProviderBillNameClash`.

Schedule edits on a bill with paid payments are allowed.

### `delete(owner, id)`

1. Resolve the bill, locked.
2. If a paid payment exists, raise `409 PROVIDER_BILL_PAID`.
3. Otherwise delete; skipped rows cascade.

### Serialization

`backend/src/bank/provider-bill-response.ts` (new) holds the explicit mapper and response types
described in `backend.md` decision 2. `expected_amount` goes through `formatAmount` with the
provider's currency.

Register the service in `BankModule`, re-export it, and add a `providerBills` key to
`BankServices` in `bank-module.loader.ts`.

## Files to Change
- `backend/src/bank/bill.service.ts` — parameterise the `kind` filter, extract shared logic, apply the new move rules.
- `backend/src/bank/bill-shared.ts` (new, name at implementer's discretion) — shared amount, paying-account, payment-lookup and move helpers.
- `backend/src/bank/provider-bill.service.ts` (new)
- `backend/src/bank/provider-bill-response.ts` (new)
- `backend/src/bank/bank.module.ts` — provider and export.
- `backend/src/bank/bank-module.loader.ts` — `providerBills` on `BankServices`.
