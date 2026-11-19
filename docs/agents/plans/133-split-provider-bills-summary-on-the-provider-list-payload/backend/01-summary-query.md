# Add the grouped summary query

Create `ProviderBillsSummaryQuery`, an `@Injectable` with an injected `ProviderBill` repository.
Model it on `AccountBalancesQuery` in `account-balances.query.ts`.

- `summaries(accountIds: number[]): Promise<Map<number, { count: number; monthly: bigint; yearly: bigint }>>`
- For an empty id list, return an empty map and run no query.
- Run one query:

  ```sql
  SELECT provider_account_id,
         COUNT(*) AS count,
         SUM(CASE WHEN kind = 'recurring' AND charge_frequency = 'monthly' THEN expected_amount END) AS monthly,
         SUM(CASE WHEN kind = 'recurring' AND charge_frequency = 'yearly'  THEN expected_amount END) AS yearly
  FROM bank_provider_bills
  WHERE provider_account_id IN (:...ids)
  GROUP BY provider_account_id
  ```

  Build it with the query builder (`select` / `addSelect` / `where` / `groupBy` /
  `getRawMany`). Convert with `Number(row.count)` and `BigInt(row.monthly ?? 0)` /
  `BigInt(row.yearly ?? 0)`, because `SUM` of no rows or of only nulls is `NULL`.
- Ids that are missing from the result get `{ count: 0, monthly: 0n, yearly: 0n }`. The caller
  can apply this default, or `summaries` can pre-fill it.
- Register it in `bank.module.ts` providers next to `AccountBalancesQuery`.
- Add an in-memory stand-in, `tests/support/in-memory-provider-bills-summary.query.ts`, with the
  same exported class name. It reads `repos.bills` and has a static `groupedCalls` counter,
  following the pattern in `in-memory-ledger.query.ts`.

## Files to Change
- `backend/src/bank/provider-bills-summary.query.ts` — new grouped query
- `backend/src/bank/bank.module.ts` — register the provider
- `backend/src/bank/tests/support/in-memory-provider-bills-summary.query.ts` — new in-memory stand-in with a call counter
