# Backend Plan: Split provider — frontend: calendar, per-bill payments and history

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produce**: `GET <base>/provider-bills/:id.json` answers `200` with the unchanged
  `ProviderBillResponse` when the bill's provider is archived.
- **Keep**: the uniform `404` for unknown, foreign, other-context and debt ids on that GET.
- **Keep**: `PATCH` / `DELETE <base>/provider-bills/:id.json` answer the uniform `404` for an
  archived-provider bill.

## Implementation Steps

### Step 1 — Allow archived providers on the single-bill GET

In `ProviderBillService.find` (`backend/src/bank/provider-bill.service.ts`, around lines 66-74),
resolve the bill with `{ allowArchived: true }`. Mirror how `list` (line 61) and
`BillHistoryService.historyForBill` already do it. Check `ProviderBillResolver.resolve`
(`provider-bill.resolver.ts:67-68`), which today forwards nothing to `peek`. If `resolve` cannot
take options yet, add an optional `options` parameter and pass it through to `peek`. The default
must stay archived-excluded so `update` / `remove` and every other caller keep their behaviour.
Update the JSDoc on `find` (and on `resolve` if it changes) to say "archived providers allowed
(read-only)".

Tests:

- `backend/src/bank/tests/provider-bills.e2e-spec.ts`, test "answers 404 for a debt, a regular
  and an archived-provider bill" (around line 456):
  - Change it so the archived-provider bill `GET` expects `200` and returns the bill.
  - Keep `PATCH` and `DELETE` expecting `404`.
  - Rename or split the test so its title stays accurate. For example, add a test "reads an
    archived-provider bill but rejects writes on it".
- `backend/src/bank/tests/provider-bill.resolver.spec.ts`: if `resolve` gains an options
  parameter, add a case for `allowArchived: true` passed through, and one for the default
  (archived excluded).
- Add or adjust a `ProviderBillService` unit spec if one covers `find`.

### Step 2 — Update the split-provider specs

The docs must match the new rule:

- `docs/agents/specs/split-provider/api/provider-bills.md`, error table (line 45): the uniform
  404 applies to `GET` only for unknown, foreign, other-context and debt ids. An archived-provider
  bill is readable through `GET` but answers `404` on `PATCH` / `DELETE`.
- `docs/agents/specs/split-provider/model.md`, "Provider archived" edge case (lines 124-125):
  - Its bills leave the Calendar.
  - The list, the single `GET` and the per-bill history stay readable.
  - `PATCH` / `DELETE` answer `404`.
  - They return to the Calendar on unarchive.
- `docs/agents/specs/split-provider/security.md`, resolution row (line 45) and line 70: note
  that reads (list, single GET, history) pass `allowArchived`, and that writes still answer the
  uniform 404 for archived providers.

## Files to Change

- `backend/src/bank/provider-bill.service.ts`: `find` resolves with `allowArchived: true`, plus
  JSDoc.
- `backend/src/bank/provider-bill.resolver.ts`: optional `options` passthrough on `resolve`, only
  if needed.
- `backend/src/bank/tests/provider-bills.e2e-spec.ts`: archived-provider GET returns 200, and
  writes still return 404.
- `backend/src/bank/tests/provider-bill.resolver.spec.ts`: options passthrough cases, only if the
  resolver changes.
- `docs/agents/specs/split-provider/api/provider-bills.md`, `model.md`, `security.md`: archived
  read/write rule.

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job:
  `backend_integration`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)

## Notes

- This widens the access rule of an existing endpoint. Ownership scoping must stay exactly as
  is. The only change is that an archived provider no longer hides the bill from a **read**.
  After this step, `security` must review it.
- Do not change the `@CachePolicy` of the route.
