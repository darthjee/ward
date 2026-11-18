# Provider-expense write-through gating, multiple-bills 409 and currency rescale

## Current behavior

`ProviderExpenseAccountHandler.saveDetails` calls `syncProviderBill`
(`account-types/provider-bill-write-through.ts`) unconditionally. `syncProviderBill` overwrites
an arbitrary recurring bill and always syncs `description = account.name`.

## Plumbing

Carry what the handler needs inside the prepared state or the `AccountTypeContext`:

- **`scheduleSent`**: whether the nested body contains any of `expected_amount`,
  `charge_frequency`, `due_day`, `due_month`, `bills_from`, `show_in_calendar` or
  `paying_account_id`. Compute it in `validateCreate` / `validateUpdate` from the nested DTO
  keys. On create, it is true whenever schedule fields are sent.
- **`nameChanged`**: compare the previous and new account name. Capture the previous name before
  `copyEditableFields` mutates it, for example by adding `previousName?` to
  `AccountTypeContext`.
- **`previousCurrency`**: already in the context.

`account.service.ts` is at 299 lines, so extract a small helper rather than growing it.

## `saveDetails` order, inside the existing transaction

1. **Lock and count.** If `scheduleSent || nameChanged || previousCurrency`, lock the provider
   account row `pessimistic_write` and load its recurring bills.
2. **Multiple-bills guard.** If `scheduleSent` and the provider has 2 or more recurring bills,
   raise `409 PROVIDER_HAS_MULTIPLE_BILLS` before anything is written. Non-schedule fields
   (`name`, `for_accountant`, `provider_tax_id`, ...) still pass.
3. **Save the details row**, as today.
4. **Currency change.** When `previousCurrency` is set:
   1. Rescale `expected_amount` on **every** bill of the provider, both kinds, using
      `convertAmountInput` (a `400` through `asBadRequest` when the amount cannot be represented),
      with rows locked.
   2. Re-check each bill's `paying_account_id` through `PayingAccountResolver` against the new
      currency (`422` on mismatch).

   Any failure rolls back the whole PATCH. Put this in a new helper,
   `backend/src/bank/account-types/provider-bill-rescale.ts`.
5. **Gated write-through.** Run it only when `scheduleSent` and the provider has 0 or 1 recurring
   bills:
   - Write onto **that** bill, not an arbitrary `findOne`.
   - Create the bill when `due_day` is first set, including after its only recurring bill was
     deleted.
   - Clearing `due_day` hides the bill.
   - Without `scheduleSent`, never create or overwrite. A name-only PATCH does not re-create a
     deleted bill.
6. **Description sync.** Only when `nameChanged` and the provider has exactly 1 recurring bill,
   set that bill's `description` to the new name. Drop `description` from `recurringFields`'
   unconditional overwrite: a schedule-only PATCH keeps a description edited through
   `/provider-bills`. A newly created bill still takes the account name.

## Tests

Extend `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts`, in the "recurring provider
bill write-through" describe:

- `409 PROVIDER_HAS_MULTIPLE_BILLS` when a schedule field is sent with 2 or more recurring bills
  (create the second bill through `/provider-bills`). `name`, `for_accountant` and
  `provider_tax_id` PATCHes still return `200`.
- The description sync runs only when `name` changes and only with exactly one recurring bill.
- After deleting the only recurring bill, setting `due_day` re-creates it, while a name-only PATCH
  does not.
- A name-only or `for_accountant` PATCH leaves a recurring bill edited through `/provider-bills`
  untouched.
- With 2 or more recurring bills, a name-only PATCH touches none of them.
- A currency change rescales every bill (both kinds). An unrepresentable amount gives `400` with
  nothing persisted. A bill paying account in the old currency gives `422`.

Update `backend/src/bank/tests/provider-expense-account.handler.spec.ts` for the new gating if it
asserts the unconditional sync.

## Files to Change
- `backend/src/bank/account-types/provider-expense-account.handler.ts` — gating, guard, call the rescale.
- `backend/src/bank/account-types/provider-bill-write-through.ts` — operate on the locked single bill; narrow the description sync.
- `backend/src/bank/account-types/provider-bill-rescale.ts` (new) — rescale every bill and re-check paying accounts.
- `backend/src/bank/account-types/account-type-handler.ts` — `AccountTypeContext.previousName?` (or equivalent plumbing).
- `backend/src/bank/account-types/provider-expense-details.ts` — carry `scheduleSent` in the prepared state if that route is chosen.
- `backend/src/bank/account.service.ts` — capture the previous name, via an extracted helper to stay under 300 lines.
- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts` — extend.
- `backend/src/bank/tests/provider-expense-account.handler.spec.ts` — adjust if needed.
