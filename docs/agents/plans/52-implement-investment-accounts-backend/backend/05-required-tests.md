# Required tests
Cover every backend item of *Required tests* in `investment.md`, plus the issue decisions,
using the debt specs as templates.

- `tests/investment-details.spec.ts` (pure helpers): merge (undefined keeps, null clears),
  pairs, serialization (`yield_rate` without trailing zeros: `"1.1000"` → `"1.1"`,
  `"0.0000"` → `"0"`, `"100.0000"` → `"100"`), defaults all null.
- `tests/investment-account.handler.spec.ts`: `validateAccount` (0 ok, non-zero 400);
  `validateCreate` / `validateUpdate` incl. the merged paired rule (PATCH `yield_rate` alone
  accepted when a period is stored; `yield_period: null` alone rejected while a rate is stored;
  both `null` clears); `loadDetails` single query; `saveDetails` writes an all-null row.
- `tests/account-type.registry.spec.ts`: investment registered; `investment` key on
  regular/debt and `debt` key on investment → 400; regular/debt `validateAccount` no-ops.
- `tests/account-dtos.spec.ts`: `describe('nested investment object')` — each `kind` accepted,
  invalid kind 400; `yield_rate` 0, 100, 4 decimals accepted; negative, >100, 5 decimals 400;
  `liquidity_days` 0 and 2147483647 accepted, negative / non-integer / 2147483648 400;
  `maturity_date` past and future accepted, `2026-02-30` and malformed 400; unknown inner key
  400; `investment: null` 400.
- `tests/account-response.spec.ts`: `investment` key present for investment accounts, absent
  for others.
- `tests/account.service.spec.ts`: create/patch call `validateAccount`; opening balance
  non-zero → 400 on create and PATCH, `'0'` / `'0.00'` accepted.
- `tests/investment-accounts.e2e-spec.ts` (mirror `debt-accounts.e2e-spec.ts`), in both
  contexts (`/api/bank`, `/api/orgs/:orgId/bank`): create with and without `investment`
  (row created all-null); common-field validation; `investment` object on create/PATCH of a
  regular account → 400; opening_balance rules (create, PATCH; archived PATCH with
  opening_balance → 409); response shape on list rows, detail, create and PATCH; PATCH partial
  merge, null clears, `type` rejected; negative balance via transactions allowed; archived:
  only `name` accepted, any `investment` field 409, format-invalid field still 400, transaction
  writes 409; delete without transactions removes the details row, with transactions 409; name
  uniqueness vs active regular and debt accounts on create, rename, unarchive → 409; list
  `type=investment` only investments, sorted, archived toggle, default list excludes them, no
  N+1 (`findCalls`); uniform 404 matrix via `support/owner-matrix.ts`; `X-Skip-Cache` on GETs;
  bodies not logged.

## Files to Change
- `backend/src/bank/tests/investment-details.spec.ts` — new
- `backend/src/bank/tests/investment-account.handler.spec.ts` — new
- `backend/src/bank/tests/investment-accounts.e2e-spec.ts` — new
- `backend/src/bank/tests/account-type.registry.spec.ts` — investment cases, no-op hooks
- `backend/src/bank/tests/account-dtos.spec.ts` — nested investment object
- `backend/src/bank/tests/account-response.spec.ts` — investment key
- `backend/src/bank/tests/account.service.spec.ts` — opening-balance hook
- `backend/src/bank/tests/debt-account.handler.spec.ts` — no-op `validateAccount`
