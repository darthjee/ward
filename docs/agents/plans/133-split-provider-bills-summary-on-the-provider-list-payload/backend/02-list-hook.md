# Add the list-only handler hook and wire it into list()

1. **Handler interface.** Add an optional hook to `AccountTypeHandler`:
   `listExtras?(accounts: Account[]): Promise<Map<number, Record<string, unknown>>>`.
   It returns top-level fields to merge into each list item. Handlers have no injected
   repositories, so `ProviderExpenseAccountHandler` gets `ProviderBillsSummaryQuery` injected
   through the module (or the registry passes the query in). Pick the approach that fits how the
   handlers are built today.
2. **Registry.** `AccountTypeRegistry.listExtras(accounts)` groups the accounts by type, the way
   `loadDetails` does, and calls the hook only for types that implement it. The result is a
   merged `Map<accountId, Record<string, unknown>>`.
3. **Provider handler.** Implement `listExtras` by calling `summaries(ids)` and mapping each
   account to
   `{ bills_summary: { count, monthly: formatAmount(monthly, account.currency), yearly: formatAmount(yearly, account.currency) } }`.
   Accounts with no bill row get count `0` and zero sums. Never include owner or organization
   ids.
4. **Response.** Add an `extra?: Record<string, unknown>` option to `SerializeAccountOptions` in
   `account-response.ts`, and spread it onto the top-level response.
5. **Service.** Call `registry.listExtras(accounts)` in `AccountService.list()` only, and pass
   each account's entry to serialization as `extra`. `find()` and the write paths do not call
   it, so the single GET and the write responses never carry `bills_summary`. First move
   `#present` / `#presentOne` into a separate presenter, such as `account.presenter.ts`, so that
   `account.service.ts` stays under 300 lines. Keep the existing behavior and spies intact.

## Files to Change
- `backend/src/bank/account-types/account-type-handler.ts` — optional `listExtras` hook
- `backend/src/bank/account-types/account-type.registry.ts` — `listExtras` dispatch grouped by type
- `backend/src/bank/account-types/provider-expense-account.handler.ts` — implement `listExtras` with `ProviderBillsSummaryQuery` and `formatAmount`
- `backend/src/bank/account-response.ts` — `extra` option merged at the top level
- `backend/src/bank/account.service.ts` — call the hook from `list()` only
- `backend/src/bank/account.presenter.ts` (new, if extracted) — the presentation helpers moved out of the service
- `backend/src/bank/bank.module.ts` — wiring, if the handler needs the query injected
