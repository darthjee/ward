# Calendar and overdue routes

Add `GET <base>/calendar.json?from=&to=` and `GET <base>/calendar/overdue.json`. Both are `user-scoped` (the class default). Occurrences are computed in memory from **three queries**; nothing is written.

## Queries

Put them in `bank/bills/calendar.query.ts`, or split into repository calls. Each takes the owner and an optional `manager`:

1. **Scheduled accounts.** The owner's `debt` / `provider_expense` accounts with `due_day` set, `show_in_calendar = true` and `archived_at IS NULL`, joined with their details. Load the default paying account's `id` and `name`, and the currency and amount needed for `expected_amount`.
2. **Payments in the range.** `bank_bill_payments` joined to the source account through `accountOwnerWhere`, with `due_date` in the widened range. Join the paying account's name.
   - The window is widened because payments are keyed by **nominal** date while the range filters on **effective** date: use `[from - 2 days, to]`.
   - For overdue, there is no lower bound. Use `due_date < today` and match payments in memory.
3. **One-off bills in the range.** `bank_bills` whose provider is owned and not archived, with `due_date` in `[from, to]` (overdue: `< today`). Join the paying account's name and the bill's payment row, if any.

If raw SQL is used:

- add an in-memory stand-in in `tests/support/` (swapped with `jest.mock`, like `ledger.query`);
- add a MySQL integration spec, `bills-calendar.integration-spec.ts`.

## Service

Add `CalendarService` (`bank/bills/calendar.service.ts`, provided in `BankModule` and exposed through `BankModuleLoader.services()` as `calendar`).

- **Building occurrences.** Combine the queries with the generator (step 04) into the occurrence shape of `bills.md`:
  - `kind`;
  - `source_account {id, name, type}`;
  - `bill {id, description} | null`;
  - `nominal_date` and `effective_date`;
  - `expected_amount`: `formatAmount`, or `null` when there is no instalment / expected amount;
  - `currency`;
  - `status`;
  - `payment {id, status, paid_on, amount, paying_account {id, name}} | null`. `paying_account` may be null after an `ON DELETE SET NULL`, so model it as nullable;
  - `default_paying_account`.
- **Status.** `paid` / `skipped` come from the payment row. Otherwise the occurrence is `overdue` when `effective_date < todayUtc(now)`, else `open`.
- **Hidden payments.** Payments whose date is not a nominal occurrence (off-schedule) are not shown.
- **Sorting.**
  - `calendar.json` sorts by `effective_date` ascending, with ties broken by `kind`, then source account id, then bill id.
  - `overdue.json` returns only `overdue` occurrences, oldest first, with the same tie-break.
- **Totals.** There is one entry per currency, built with `formatAmount` and never summed across currencies.
  - `calendar.json`: `{ currency, expected, paid, open }`.
    - `expected` is the sum of the expected amounts.
    - `paid` is the sum of `payment.amount` for paid occurrences.
    - `open` is the sum of the expected amounts of open and overdue occurrences.
    - Occurrences with a null expected amount count toward neither `expected` nor `open`. Skipped occurrences count toward neither `paid` nor `open`.
  - `overdue.json`: `{ currency, open }`.
  - A currency with no rows gets no entry; an empty result gives `totals: []`.
  - Keep the totals in a small pure helper (`calendar-totals.ts`) so they are unit-testable.
- **Envelope.** Both routes answer `{ occurrences, totals }`.

## Query DTO

Add `bank/dto/calendar-query.dto.ts`:

- `from` and `to` are required and must be valid ISO dates (`isIsoDate`);
- `from > to` → 400;
- a range over 366 days → 400.

Mirror `assertHandOffRange` / `handOffValidationFailed` (code `VALIDATION_FAILED`).

## Controller

Add `bank/calendar.controller.ts`:

- `@OwnerScopedController('bank')`, registered in `bank-routes.module.ts`;
- thin: it delegates to `loader.services().calendar`.

## Tests

- **Unit specs:**
  - status derivation and sorting / tie-break;
  - the totals rules, including null expected amounts, skipped occurrences, multiple currencies and the empty range;
  - the archived / hidden account exclusion;
  - an archived provider hides its one-off bills.
- **e2e specs:**
  - the range validation 400s, including 366 vs 367 days;
  - the owner-context matrix (`NOT_FOUND_CASES`, `createOwnerFixtures`) on both routes. Personal never shows organization bills and vice versa;
  - `X-Skip-Cache` is set;
  - no owner keys (`ownerKeysIn`).
- **Integration spec** for the raw SQL, if any.

## Files to Change

- `backend/src/bank/bills/calendar.query.ts` — the three queries
- `backend/src/bank/bills/calendar.service.ts` — build the occurrences and envelopes
- `backend/src/bank/bills/calendar-totals.ts` — pure totals helper
- `backend/src/bank/bills/occurrence-response.ts` — serializer for the occurrence shape, shared with step 07
- `backend/src/bank/dto/calendar-query.dto.ts` — from / to validation and the 366-day cap
- `backend/src/bank/calendar.controller.ts` — new controller
- `backend/src/bank/bank-routes.module.ts`, `bank.module.ts`, `bank-module.loader.ts` — registration and the `calendar` service
- `backend/src/bank/tests/calendar*.spec.ts`, `calendar.e2e-spec.ts`, `tests/support/in-memory-calendar.query.ts` — tests
- `backend/src/database/tests/integration/bills-calendar.integration-spec.ts` — real SQL
