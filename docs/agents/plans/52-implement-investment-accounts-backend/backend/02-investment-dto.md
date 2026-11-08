# Nested investment DTO and validators
Add `InvestmentDetailsDto` and wire it into the account bodies, as `DebtDetailsDto` is.

- `dto/investment-details.dto.ts`, all fields `@IsOptional()` (so `null` clears):
  - `kind`: `@IsIn(INVESTMENT_KINDS)` with
    `['fixed_income','fund','stocks','savings','pension','crypto','other']` (export the const).
  - `yield_rate`: `@IsInterestRate()` (string, 0–100, at most 4 decimals; rejects negatives).
  - `yield_period`: `@IsIn(['monthly','yearly'])` (reuse `DEBT_PERIODS` or extract a shared
    `RATE_PERIODS`).
  - `maturity_date`: new `@IsCalendarDate()` decorator in `dto/field-validators.ts`, built with
    `ValidateBy` around `isIsoDate` from `bank/ledger-date.ts` (real calendar date, any range).
    Do **not** use `IsLedgerDate` (it has the today+1 bound).
  - `liquidity_days`: `@IsInt() @Min(0) @Max(MAX_INT_COLUMN)`; extract the 2147483647 constant
    (today `MAX_INSTALMENT_COUNT` in `debt-details.dto.ts`) into a shared constant and reuse it
    for both.
- `CreateAccountDto` / `UpdateAccountDto`: add
  `@IsOptionalNonNull() @IsObject() @ValidateNested() @Type(() => InvestmentDetailsDto) investment?`
  (so `investment: null` → 400; unknown inner keys → 400 via the whitelist pipe). `type` stays
  absent from `UpdateAccountDto`.
- `opening_balance` DTO rules are unchanged; the zero rule lives in the handler (step 03).

## Files to Change
- `backend/src/bank/dto/investment-details.dto.ts` — new DTO and `INVESTMENT_KINDS`
- `backend/src/bank/dto/field-validators.ts` — `IsCalendarDate()`, shared int bound (and period list if extracted)
- `backend/src/bank/dto/debt-details.dto.ts` — use the shared constants
- `backend/src/bank/dto/create-account.dto.ts` — `investment` property
- `backend/src/bank/dto/update-account.dto.ts` — `investment` property
