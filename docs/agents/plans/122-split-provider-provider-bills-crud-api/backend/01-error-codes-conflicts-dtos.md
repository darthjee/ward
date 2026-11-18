# Error codes, conflicts and DTOs

Add the building blocks the routes need: the new error codes, the conflict factories, and the
whitelisted DTOs with merged-state validation.

- **`ErrorCodes`.** Add `PROVIDER_BILL_KIND_LOCKED`, `PROVIDER_BILL_PROVIDER_LOCKED`,
  `PROVIDER_BILL_NAME_TAKEN`, `PROVIDER_BILL_PAID`, `PROVIDER_BILL_LIMIT` and
  `PROVIDER_HAS_MULTIPLE_BILLS`.
- **`backend/src/bank/provider-bill-conflicts.ts` (new).** One factory per code above, each
  returning a `409` with the same body shape as `bill-conflicts.ts`, plus:
  - `mapProviderBillNameClash(write)`: maps `isMysqlError(e, MYSQL_DUPLICATE_ENTRY)` to
    `PROVIDER_BILL_NAME_TAKEN`;
  - `PROVIDER_BILL_RECURRING_LIMIT = 50`;
  - `sameDescription(a, b)`: trimmed, `localeCompare` with `sensitivity: 'base'`.
- **DTOs.**
  - `CreateProviderBillDto`:
    - `kind` is `recurring` or `one_off` and required.
    - `description` is trimmed, required and at most `DESCRIPTION_MAX_LENGTH`.
    - `expected_amount` is a decimal string.
    - `paying_account_id` is an int or null.
    - `notes` is capped at `NOTES_MAX_LENGTH`.
    - The recurring group is `charge_frequency` (reuse `ProviderChargeFrequency`), `due_day`,
      `due_month`, `bills_from` (`IsCalendarDate`) and `show_in_calendar`.
    - The one-off group is `due_date` (`IsCalendarDate`).
  - `UpdateProviderBillDto`: the same fields, all optional, using `IsOptionalNonNull` where null is
    not meaningful. It also accepts `kind` (compared, never applied) and `provider_account_id`.
  - `ListProviderBillsQueryDto`: `kind` is a free string (unknown values give an empty list), and
    `page` stays raw for `parsePage`.
  - None of the DTOs accepts `id`, timestamps or an owner. `@StrictBody()` rejects them.
- **Merged-state validator** (`backend/src/bank/provider-bill-fields.ts`, new). It takes the
  stored row (or the create defaults) plus the patch and returns the entity fields, or throws
  `400`. It applies the `model.md` matrix:
  - **Recurring.** `charge_frequency` defaults to `monthly`, `bills_from` to UTC today and
    `show_in_calendar` to `true`. `due_day` is required. `due_month` is required only when the
    frequency is `yearly`, otherwise it is null. `due_date` must be null. `expected_amount` is
    optional and must be > 0.
  - **One-off.** `due_date` and `expected_amount` (> 0) are required. Every recurring field must
    be null.
  - A field of the other group is `400`, checked on the merged state.
  - A different `kind` on PATCH is `409 PROVIDER_BILL_KIND_LOCKED`. This check runs in the
    service, not as a `400`.
  - Reuse the pair rule from `account-types/schedule-fields.ts` and `assertProviderExpensePairs`
    where possible.
- **Tests.** `backend/src/bank/tests/provider-bill-dtos.spec.ts` (new), following the
  `account-dtos.spec.ts` pattern. Cover:
  - every `400` on create and on merged PATCH (other-group fields, `due_month` pairing,
    `expected_amount > 0`, non-whitelisted fields, description length);
  - the defaults;
  - `kind` change gives `409`.

## Files to Change
- `backend/src/core/error-codes.ts` — six new codes.
- `backend/src/bank/provider-bill-conflicts.ts` (new) — 409 factories, `ER_DUP_ENTRY` mapping, cap constant, `sameDescription`.
- `backend/src/bank/dto/create-provider-bill.dto.ts` (new)
- `backend/src/bank/dto/update-provider-bill.dto.ts` (new)
- `backend/src/bank/dto/list-provider-bills-query.dto.ts` (new)
- `backend/src/bank/provider-bill-fields.ts` (new) — merged-state validation and defaults.
- `backend/src/bank/tests/provider-bill-dtos.spec.ts` (new)
