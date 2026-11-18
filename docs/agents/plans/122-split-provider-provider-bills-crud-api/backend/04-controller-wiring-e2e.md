# Controller, module wiring and e2e

## Controller

Add `ProviderBillsController` (`backend/src/bank/provider-bills.controller.ts`, new) with
`@OwnerScopedController('bank')`, mirroring `bills.controller.ts`. It is thin and delegates to
`BankModuleLoader.services().providerBills`.

| Route | Handler | Cache |
|---|---|---|
| `GET accounts/:accountId/provider-bills.json` | `@Query(QUERY_PIPE) ListProviderBillsQueryDto`, `parsePage` | `user-scoped` (inherited) |
| `POST accounts/:accountId/provider-bills.json` | `@StrictBody() CreateProviderBillDto`, `201` | `@CachePolicy(CacheClass.Never)` |
| `GET provider-bills/:id.json` | | `user-scoped` (inherited) |
| `PATCH provider-bills/:id.json` | `@StrictBody() UpdateProviderBillDto` | `@CachePolicy(CacheClass.Never)` |
| `DELETE provider-bills/:id.json` | `@HttpCode(204)` | `@CachePolicy(CacheClass.Never)` |

- Write routes inherit `InvalidatesOwner()`.
- Parse `:accountId` and `:id` with `parseId`; a malformed id gives the uniform `404`.
- Add the controller to `BankRoutesModule.controllers`.

## In-memory repo

Update `backend/src/bank/tests/support/in-memory-bank-repos.ts`:

- `checkProviderBillKeys` compares recurring descriptions with `sameDescription`, which is case-
  and accent-insensitive, and throws `mysqlError('ER_DUP_ENTRY')`.
- Add `count` / `countBy` only if the service uses them.
- Make sure `findOne` with a lock works on the accounts repo, for the provider-row lock.
- Keep the file under 300 lines; split into a helper file if needed.

## e2e spec

Add `backend/src/bank/tests/provider-bills.e2e-spec.ts` (new). Use `buildBankTestApp`, `base()`,
`NOT_FOUND_CASES`, and `beforeNextTransaction` for races. Cover:

- Full CRUD on `/bank` and `/orgs/:orgId/bank`, for both kinds, with the defaults applied.
- Pagination (51+ rows across both kinds), ordering (recurring by description, then one-offs by
  newest `due_date`), the `kind` filter, an unknown `kind` returning an empty list, and an invalid
  `page` returning `400`.
- The `404` matrix:
  - unknown, foreign, other-context and archived-provider bill ids, plus a malformed id;
  - nested debt, regular, foreign or unknown `:accountId`;
  - cross-owner and cross-org denial on every verb;
  - identical bodies in every case.
- Archived provider: listing is allowed, create returns `409 ACCOUNT_ARCHIVED`.
- Conflicts:
  - `NAME_TAKEN`, case- and accent-insensitive (`"Água"` vs `"agua"`), on create and on rename.
    One-offs may repeat a description, and a one-off may share one with a recurring bill.
  - `KIND_LOCKED`.
  - `PROVIDER_LOCKED`, sent with a foreign target id: the response is still `409`, not `404`.
  - `PAID` on delete. Delete with only skipped rows succeeds and cascades them.
  - `LIMIT` on the 51st recurring bill.
- One-off move rules:
  - `422 CURRENCY_MISMATCH` for a target in another currency;
  - `409 ACCOUNT_ARCHIVED` for an archived target;
  - uniform `404` for an unknown or foreign target;
  - `409 PROVIDER_BILL_PAID` for a paid one-off;
  - `paying_account_id` re-checked against the target.
- A schedule edit on a recurring bill with paid payments succeeds.
- `422 ACCOUNT_NOT_FOUND` / `CURRENCY_MISMATCH` from `PayingAccountResolver`.
- Non-whitelisted fields (`id`, `owner_id`, `created_at`) give `400`.
- Cache headers: `X-Cache-Allow` on GETs; `X-Skip-Cache` and owner invalidation on writes.

Confirm that `cache-policy.coverage.spec.ts` stays green.

## Files to Change
- `backend/src/bank/provider-bills.controller.ts` (new)
- `backend/src/bank/bank-routes.module.ts` — register the controller.
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — collation-like uniqueness and any missing repo methods.
- `backend/src/bank/tests/provider-bills.e2e-spec.ts` (new)
