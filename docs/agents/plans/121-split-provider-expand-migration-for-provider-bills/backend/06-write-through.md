# Write-through from provider-expense create/PATCH

Keep the provider's single recurring bill in sync with its schedule columns, so the backfill
never goes stale before #123 moves the reads.

Add a small collaborator, e.g. `bank/account-types/provider-bill-write-through.ts`, with
`sync(account, state, manager)`. Call it from
`ProviderExpenseAccountHandler.saveDetails` after the details save. It runs inside the same
transaction (the `manager` passed by `AccountService#saveWithDetails`), so a failure rolls back
both writes. It only touches bills whose `providerAccountId` is the account being saved, an
account that `AccountService` has already loaded owner-scoped.

Logic, using the merged `ProviderExpenseState`:
1. Load the provider's recurring bill: `{ providerAccountId: account.id, kind: 'recurring' }`,
   with a pessimistic write lock.
2. **`dueDay` set:**
   - Bill missing → insert one with `kind='recurring'`, `description = account.name`, and copy
     `expectedAmount`, `chargeFrequency`, `dueDay`, `dueMonth`, `billsFrom`, `showInCalendar`
     and `payingAccountId`.
   - Bill present → update the same fields and `description = account.name`. This also restores
     `showInCalendar` from the state.
3. **`dueDay` null:**
   - Bill present → set only `showInCalendar = false`. Keep its last `dueDay` / `dueMonth` and
     never delete it (deleting would cascade the payment history). `description` is still
     synced to the name.
   - Bill missing → do nothing.
4. It is idempotent: name-only and archived-account PATCHes re-run it harmlessly.

Do **not** add `409 PROVIDER_HAS_MULTIPLE_BILLS` (that is #122). Only one recurring bill can
exist in this issue.

## Specs
- `provider-expense-account.handler.spec.ts` (unit, mocked manager), covering each branch above.
- `provider-expense-accounts.e2e-spec.ts` / `schedule-fields.e2e-spec.ts` (inspect
  `repos.bills`):
  - Create with `due_day` creates one recurring bill with the copied fields, and create without
    it creates none.
  - A PATCH that first sets `due_day` creates it, and a later PATCH updates the same bill.
  - `due_day: null` keeps the bill with `show_in_calendar = false` and its last `due_day`, and
    its payments survive.
  - Setting `due_day` again reuses the same bill id and restores `show_in_calendar`.
  - Renaming the provider updates the bill's `description`.
  - Provider responses are unchanged (they still read the details columns).

## Files to Change
- `backend/src/bank/account-types/provider-bill-write-through.ts` — new helper.
- `backend/src/bank/account-types/provider-expense-account.handler.ts` — call the write-through in `saveDetails`.
- `backend/src/bank/bank.module.ts` — provider wiring, if the helper is injectable.
- `backend/src/bank/tests/provider-expense-account.handler.spec.ts`, `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts`, `backend/src/bank/tests/schedule-fields.e2e-spec.ts` — new cases.
