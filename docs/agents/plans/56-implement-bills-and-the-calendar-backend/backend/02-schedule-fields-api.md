# Schedule fields: paying-account validation and response

The `debt` / `provider_expense` objects on the generic account routes accept and return the schedule fields:

- `bills_from` (`YYYY-MM-DD` or `null`);
- `show_in_calendar` (boolean);
- `paying_account: { id, name } | null`.

The body accepts `paying_account_id`. The response returns `paying_account`, with no owner fields.

## 422 helper

Add a shared helper `bank/body-reference-errors.ts`, with a new `ErrorCodes` entry or entries in `core/error-codes.ts`:

- `accountNotFoundInBody()` → `UnprocessableEntityException({ code: ErrorCodes.ACCOUNT_NOT_FOUND, message: 'account not found' })`. The body is identical for every reason.
- `currencyMismatch()` → `UnprocessableEntityException({ code: ErrorCodes.CURRENCY_MISMATCH, message: 'currency mismatch' })`.

## Paying-account resolver

Add a `PayingAccountResolver` (e.g. `bank/paying-account.resolver.ts`, in `BankModule`), reused by steps 06 and 07.

- **`resolve(owner, id, currency, manager?)`** loads the account through `accountOwnerWhere(owner)`.
  - Unknown, another owner's, other-context, non-`regular` or archived → `accountNotFoundInBody()`.
  - Different currency → `currencyMismatch()`.
- **Hooking it into the account routes.** The handler hooks are synchronous and owner-less, so the check runs in the async account flow, before `#saveWithDetails`.
  - `account.service.ts` is at about 293 lines, so add a thin call into a new collaborator (e.g. `account-schedule.validator.ts`) rather than inline logic.
  - Validate only when `paying_account_id` is sent and non-null.
  - On update, use the stored account's currency. Because the currency is locked once there are transactions, also re-check the stored `payingAccountId` whenever the currency changes.
- **Inline name lookup.** Expose a small `namesById(ids, manager)` lookup (or a join) to build `paying_account`.

## Response

- **Loading the name.** Extend `loadDetails` in `debt-account.handler.ts` and `provider-expense-account.handler.ts` to also load the paying account's `id` and `name`, batched (for example a `LEFT JOIN bank_accounts` through the `EntityManager`). `serialize` stays synchronous.
- **Serializing.** `serializeXState` adds:
  - `bills_from`;
  - `show_in_calendar`;
  - `paying_account: { id, name } | null`, which replaces the raw id in the response, as the spec and issue require. It never carries owner fields.

## Tests

- **Validation:** the `paying_account_id` 422 cases (unknown, another owner, other context, non-regular, archived), all with an identical body, and the currency mismatch.
- **Round-trip:** the three fields round-trip through create / update / show / list for debt and provider; `show_in_calendar` defaults to `true`.
- **Ownership:** `ownerKeysIn` finds no owner fields in `paying_account`.
- **Regression:** the existing account, debt and provider specs pass unchanged. Additive fields may require updating exact-shape expectations; only touch those.

## Files to Change

- `backend/src/core/error-codes.ts` — the new 422 codes
- `backend/src/bank/body-reference-errors.ts` — new 422 helpers
- `backend/src/bank/paying-account.resolver.ts` — new resolver (registered in `bank.module.ts`)
- `backend/src/bank/account-schedule.validator.ts` (or similar) — the async schedule-field validation called from `AccountService` create / update
- `backend/src/bank/account.service.ts` — a thin call into the validator, plus passing `today` into the merge
- `backend/src/bank/account-types/debt-account.handler.ts`, `provider-expense-account.handler.ts` — load the paying-account name
- `backend/src/bank/account-types/debt-details.ts`, `provider-expense-details.ts` — serialize the new fields
- `backend/src/bank/bank.module.ts` — provide the new classes
- `backend/src/bank/tests/` — unit and e2e specs for the above
