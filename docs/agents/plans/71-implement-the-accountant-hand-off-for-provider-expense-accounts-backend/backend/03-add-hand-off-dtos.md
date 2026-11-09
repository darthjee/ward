# Add the hand-off DTOs

## `AccountantChargesQueryDto`
File: `dto/accountant-charges-query.dto.ts`. Build it like `ListAccountsQueryDto`, used with a
`ValidationPipe({ whitelist: true, transform: true })` on `@Query`.

- **`from` / `to`.** Required. Each must be a real `YYYY-MM-DD` date not after UTC today + 1 day,
  validated with the existing `IsLedgerDate()` (`dto/field-validators.ts`, which wraps
  `isAllowedLedgerDate`). Add no new date parser. Missing or invalid → `400 VALIDATION_FAILED`.
- **`include_sent`.** Optional, `@IsIn(['true', 'false'])`, default `false`. Any other value → `400`.
- **Repeated parameters.** They arrive as arrays and fail validation → `400`.
- **Unknown parameters.** Stripped (ignored).
- **Cross-field range rules.** Enforce these in the service or controller with a
  `BadRequestException` (`VALIDATION_FAILED`). A small helper, e.g. `assertHandOffRange(from, to)`,
  can sit in the DTO file.
  - `from` after `to` → `400`.
  - `from == to` is allowed.
  - `to − from` may be at most 366 days, so `2026-01-01` → `2027-01-02` is accepted. More → `400`.

## `MarkChargesDto`
File: `dto/mark-charges.dto.ts`, used with `@StrictBody()`.

- `transaction_ids` uses `@IsArray() @ArrayNotEmpty() @ArrayMaxSize(1000)` and
  `@IsInt({ each: true }) @Min(1, { each: true }) @Max(MAX_ID, { each: true })`, with `MAX_ID`
  from `core/parse-id.ts`.
- An entry that is not a positive integer → `400` (validation), not `404`.
- An empty list → `400`. More than 1000 ids → `400`.
- De-duplicate later, in the service.
- Any other body field → `400` (strict body).

Add unit specs for both DTOs, following the pattern in `tests/account-dtos.spec.ts`.

## Files to Change
- `backend/src/bank/dto/accountant-charges-query.dto.ts` — new query DTO and range helper
- `backend/src/bank/dto/mark-charges.dto.ts` — new body DTO
- `backend/src/bank/tests/accountant-dtos.spec.ts` — DTO validation specs
