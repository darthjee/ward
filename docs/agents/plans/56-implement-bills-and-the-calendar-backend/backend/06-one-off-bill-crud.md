# One-off bill CRUD

Add these routes:

- `GET` and `POST <base>/bills.json`;
- `GET`, `PATCH` and `DELETE <base>/bills/:id.json`.

`GET` is `user-scoped`; the writes are `never`, and `DELETE` returns 204.

## DTOs

Add `bank/dto/create-bill.dto.ts` and `update-bill.dto.ts`, used via `@StrictBody()` (unknown fields → 400):

- `provider_account_id`: a positive integer, required on create;
- `paying_account_id`: a positive integer, required on create. On update, `null` is accepted and clears it: the column is nullable and the spec says "yes on create", and with no paying account the Pay dialog requires a choice;
- `due_date`: `IsCalendarDate`; past dates are allowed;
- `amount`: a decimal string, parsed with `parseAmountInput` in the provider's currency. It must be > 0 and within 10¹³ minor units and the currency's decimals, otherwise 400;
- `description`: trimmed, non-empty, at most 255 code points (`@MaxCodePoints`);
- `notes`: optional, at most 2000 characters.

Values out of bounds → 400, never truncated.

## Service

Add `BillService` (`bank/bills/bill.service.ts`, exposed as `bills` in the loader).

- **Path ids.** Resolve `:id` with `parseId`, then load the bill joined to a provider owned by the caller (`accountOwnerWhere`) and not archived. Otherwise `ownerNotFound()`: an archived provider hides its bills (404).
- **Provider in the body.** Resolve `provider_account_id` as an owned `provider_expense` account in the active context; otherwise `accountNotFoundInBody()` (422, step 02).
  - **Open point.** The spec's body-reference rule lists an archived *paying* account, but says nothing about an archived *provider*.
  - **Default.** Treat an archived provider as 422 "account not found", since its bills are hidden anyway.
  - **Comment on issue #56.** Record this choice there so it can be confirmed or changed, instead of deviating silently.
- **Paying account in the body.** Resolve `paying_account_id` with `PayingAccountResolver` (step 02) against the **provider's** currency, which gives 422 "account not found" or 422 "currency mismatch". Changing `provider_account_id` re-checks the stored or sent paying account's currency.
- **List.** `bills.json` takes an optional `provider_account_id` filter; an unknown, another owner's or non-provider id gives an empty list, never a 404. Results are sorted by `due_date` DESC, then `id` DESC, and paginated with `parsePage` / `buildPagination` (`LEDGER_PER_PAGE`). The envelope is `{ bills, pagination }`.
- **Delete.**
  - A bill whose payment row is `paid` → 409, via a new `billPaid()` conflict helper in `account-conflicts.ts` or `bill-conflicts.ts`, with a new `ErrorCodes` entry.
  - An unpaid or skipped bill is hard-deleted together with its payment row, in one `manager.transaction`. The FK cascade also covers this; delete explicitly anyway so the in-memory harness behaves the same.

## Response

The response is built by `bank/bills/bill-response.ts`:

- `id`;
- `provider_account {id, name}`;
- `paying_account {id, name} | null`;
- `due_date`;
- `amount` (decimal string);
- `currency` (the provider's);
- `description` and `notes`;
- `payment` (the occurrence's payment shape) or `null`;
- `created_at` and `updated_at`.

It has no owner fields.

## Controller

Add `bank/bills.controller.ts` (`@OwnerScopedController('bank')`). It is thin.

## Tests

- **CRUD:** create, show, list (filter, empty-filter cases, pagination, invalid page → 400), update and delete.
- **Bodies:** field limits → 400, the unknown-field whitelist, the 422 "account not found" matrix with identical bodies, and the currency mismatch, including when the provider changes.
- **Delete rules:** delete when paid → 409; delete when unpaid or skipped removes the bill and its payment row.
- **Path ids:** 404 `NOT_FOUND_CASES` on `:id`, plus an archived provider → 404.
- **Owner matrix and responses:** the owner matrix, no owner keys, and `X-Skip-Cache` on the GETs.

## Files to Change

- `backend/src/bank/dto/create-bill.dto.ts`, `update-bill.dto.ts`, `list-bills-query.dto.ts` — new DTOs
- `backend/src/bank/bills/bill.service.ts` — CRUD service
- `backend/src/bank/bills/bill-response.ts` — serializer
- `backend/src/bank/account-conflicts.ts` (or `bills/bill-conflicts.ts`) and `backend/src/core/error-codes.ts` — the `billPaid` 409
- `backend/src/bank/bills.controller.ts` — new controller
- `backend/src/bank/bank-routes.module.ts`, `bank.module.ts`, `bank-module.loader.ts` — registration
- `backend/src/bank/tests/bill*.spec.ts`, `bills.e2e-spec.ts` — tests
