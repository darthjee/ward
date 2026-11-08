# Add the nested `debt` DTO

Today `debt` is not declared on the account DTOs, so `forbidNonWhitelisted` rejects it before
any handler runs. Declare it with real nested validation so unknown keys inside `debt` are
rejected by the whitelist pipe, as the spec requires.

- New `DebtDetailsDto` (`backend/src/bank/dto/debt-details.dto.ts`), every field optional and
  nullable (`@IsOptional()` lets `null` through; "absent" vs "`null`" must stay
  distinguishable for PATCH merge — check with `'field' in dto` / `presentFields`):
  - `interest_rate`: string matching `^\d+(\.\d{1,4})?$`, numeric value 0–100.
  - `interest_period`: `@IsIn(['monthly','yearly'])`.
  - `instalment_amount`: string (parsed against the account currency in the handler, since
    the exponent depends on the account).
  - `instalment_frequency`: `@IsIn(['monthly','yearly'])`, **not** nullable (use the existing
    `IsOptionalNonNull`).
  - `due_day`: `@IsInt() @Min(1) @Max(31)`; `due_month`: `@IsInt() @Min(1) @Max(12)`;
    `instalment_count`: `@IsInt() @Min(1)`.
- Add `debt?: DebtDetailsDto` to `CreateAccountDto` and `UpdateAccountDto` with
  `@IsOptionalNonNull()` (or `@IsOptional()` + `@IsObject()`), `@ValidateNested()`,
  `@Type(() => DebtDetailsDto)`. Confirm `StrictValidationPipe` (`whitelist`,
  `forbidNonWhitelisted`, `transform`) rejects unknown nested keys with 400.
- Range / format checks live here; paired rules (rate ↔ period, yearly ↔ due_month) and
  amount parsing live in the handler (step 03) because PATCH must check the merged state.

## Files to Change
- `backend/src/bank/dto/debt-details.dto.ts` — new nested DTO.
- `backend/src/bank/dto/create-account.dto.ts` — add `debt`.
- `backend/src/bank/dto/update-account.dto.ts` — add `debt`.
- `backend/src/bank/dto/field-validators.ts` — any shared decorator (e.g. interest-rate validator) if useful.
- `backend/src/bank/tests/account-dtos.spec.ts` — DTO-level boundary cases.
