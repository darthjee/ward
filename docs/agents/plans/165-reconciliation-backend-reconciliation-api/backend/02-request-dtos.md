# Request DTOs

Add the request DTOs. They are validated through `@StrictBody()`, so any extra field is a 400.
That includes `account_id`, `status`, `reconciled_at`, `reconciliation_id` and `reconciliation`.

**`CreateReconciliationDto`:**

- `statement_date`: `@IsLedgerDate()` from `dto/field-validators.ts`. It must be a real calendar
  day, at most UTC today + 1 day.
- `statement_balance`: `@IsString()` only. The service parses the amount against the account
  currency in step 04.

**`UpdateReconciliationDto`:** the same two fields, each `@IsOptional()`.

**`ReconciliationTicksDto`:**

- `tick` and `untick` are each optional and default to `[]`.
- Each uses `@IsArray()`, `@ArrayMaxSize(RECONCILIATION_TICK_MAX_IDS)` with
  `RECONCILIATION_TICK_MAX_IDS = 50`, `@IsInt({ each: true })`, `@Min(1, { each: true })` and
  `@Max(MAX_ID, { each: true })`. This follows `mark-charges.dto.ts`, with a cap of 50 instead of
  `MARK_MAX_IDS`.
- The cap applies to the raw array length.

**Ticks body checks.** These are 400s that do not need the account. Put them in a pure helper,
for example `normalizeTicks(dto): { tick: number[]; untick: number[] }`, that the controller or
the service runs before any DB access. Each failure is a 400 with a fixed message that never
echoes the values. The helper:

1. de-duplicates each array;
2. rejects the body when both arrays are empty after de-duplication;
3. rejects overlapping `tick` and `untick`.

**Finish and undo** take `{}`. Use an empty strict DTO, or the existing empty-body pattern if one
exists, so that extra fields are a 400.

Add DTO unit specs:

- bounds: 51 raw ids is a 400, 50 duplicates are accepted, and non-integer, 0 and `MAX_ID + 1`
  are 400s;
- the date at today + 1 day is accepted, and the day after is a 400;
- extra and mass-assignment fields are 400s;
- the `normalizeTicks` cases.

## Files to Change
- `backend/src/bank/dto/reconciliation.dto.ts` (new) — the create, update, ticks and empty DTOs
  and the cap constant.
- `backend/src/bank/reconciliation-ticks.ts` (new) — `normalizeTicks` and its fixed 400s.
- `backend/src/bank/tests/reconciliation-dtos.spec.ts` (new) — the DTO and normalization unit specs.
