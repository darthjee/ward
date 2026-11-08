# Tests covering the spec's *Required tests*

Cover every backend bullet of `debt.md` § *Required tests* with Jest specs.

- In-memory harness: add a `DebtDetails` repository to `fakeDataSource()` in
  `bank/tests/support/build-bank-test-app.ts` / `in-memory-bank-repos.ts`, supporting `In()`
  lookups, save/upsert, and cascade removal when the owning account is deleted.
- New `bank/tests/debt-accounts.e2e-spec.ts`, run through `support/owner-matrix.ts` for both
  `/api/bank` and `/api/orgs/:orgId/bank`:
  - create with / without `debt` (default row: all null, frequency `monthly`);
  - every 400 case and accepted boundary listed in the spec (`due_day` 0/1/31/32, `due_month`
    0/1/12/13, `instalment_count` 0/1, `instalment_amount` 0 / negative / over bound / too
    many decimals, `interest_rate` negative / 0 / 100 / >100 / 4 vs 5 decimals, unpaired
    rate/period, yearly without `due_month`, `due_month` with monthly, unknown nested key,
    `debt` on a regular account on create and PATCH);
  - `debt` object shape on list rows, detail, create / PATCH responses; absent on regular;
  - PATCH partial merge, `null` clears, rate cleared with both `null`, merged-state examples
    from the issue, `yearly` → `monthly` clears `due_month`, `type` rejected;
  - currency change rescales `instalment_amount`; `12.50` BRL → JPY → 400; with transactions → 409;
  - `opening_balance` negative / zero / positive; overpayment allowed;
  - archived debt: only `name` (any `debt` field → 409, including an invalid one); transaction writes → 409;
  - delete without transactions removes the details row; with transactions → 409;
  - name clash with an active regular account (case-insensitive) → 409 on create, rename, unarchive;
  - list `type=debt` only debts, sorted, archived filter; default list excludes debts; no N+1
    (assert query counts / single batch load);
  - 404 with identical bodies for unknown, non-numeric, foreign, wrong-context ids and non-member `:orgId`;
  - `GET` routes send `X-Skip-Cache` / `user-scoped`, writes `never`;
  - bodies not logged.
- Integration (`ward_mysql_test`): `ON DELETE CASCADE` on the real schema.

## Files to Change
- `backend/src/bank/tests/support/build-bank-test-app.ts` — fake `DebtDetails` repo.
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — debt-details store + cascade.
- `backend/src/bank/tests/debt-accounts.e2e-spec.ts` — new e2e spec.
- `backend/src/bank/tests/accounts.e2e-spec.ts` — update any existing "`type: debt` → 400" expectation.
- `backend/src/bank/tests/account-response.spec.ts` — `debt` key serialization.
