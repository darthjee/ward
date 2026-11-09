# Nested DTO

Add `ProviderExpenseDetailsDto` and wire it into the account bodies as
`provider_expense?: ProviderExpenseDetailsDto` with
`@IsOptionalNonNull() @IsObject() @ValidateNested() @Type(() => ProviderExpenseDetailsDto)`
(so `provider_expense: null` → `400`, as `debt` / `investment`).

Field rules:

- `for_accountant` — `@IsOptionalNonNull() @IsBoolean()` (`null` → `400`).
- `provider_tax_id` — `@Transform(trimToNull) @IsOptional() @IsString() @MaxCodePoints(32)`
  (add a `PROVIDER_TAX_ID_MAX_LENGTH = 32` constant in `field-validators.ts`).
- `expected_amount` — `@IsOptional() @IsString()`; currency-aware parsing (> 0, decimals,
  bound) happens in the handler, as debt's `instalment_amount`.
- `due_day` — `@IsOptional() @IsInt() @Min(1) @Max(31)`.
- `charge_frequency` — `@IsOptionalNonNull() @IsIn(RATE_PERIODS)` (`monthly` / `yearly`).
- `due_month` — `@IsOptional() @IsInt() @Min(1) @Max(12)`.

Unknown keys are rejected by the strict whitelist pipe. Extend `account-dtos.spec.ts` with a
"nested provider_expense object" describe (valid object, `null` object, each out-of-range /
wrong-type field, `null` on the non-nullable fields, over-long tax id, blank tax id → `null`,
unknown key).

## Files to Change

- `backend/src/bank/dto/provider-expense-details.dto.ts` — new DTO.
- `backend/src/bank/dto/create-account.dto.ts` — `provider_expense` field, JSDoc.
- `backend/src/bank/dto/update-account.dto.ts` — `provider_expense` field, JSDoc.
- `backend/src/bank/dto/field-validators.ts` — `PROVIDER_TAX_ID_MAX_LENGTH`.
- `backend/src/bank/tests/account-dtos.spec.ts` — nested object cases.
