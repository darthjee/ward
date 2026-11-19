# Backend Plan: Split provider — bills_summary on the provider list payload

Main plan: [plan.md](plan.md)

## Overview

`AccountService.list()` gives every `provider_expense` account a top-level `bills_summary`. It is
built from one grouped SQL query over `bank_provider_bills` for all the account ids the list
returns. The value is attached through a new optional list-only hook on `AccountTypeHandler`,
which only `ProviderExpenseAccountHandler` implements.

## Context

- `accounts.json` is not paginated, and today the only source for these numbers is the
  paginated `provider-bills.json`. Using it would mean one request per row.
- `AccountService.#present(accounts, mask)` is shared by list, create, update, archive and
  unarchive. `mask === true` does **not** mean "list", so the hook must be called from `list()`
  only.
- `ProviderExpenseAccountHandler.loadDetails` loads only recurring bills (and also runs for
  the single GET), so it cannot supply `count`. It stays unchanged.
- `account.service.ts` is at 299 of the 300 lines lint allows.
- Contract (per provider account in the list):

  ```json
  "bills_summary": { "count": 3, "monthly": "250.00", "yearly": "1200.00" }
  ```

  - `count`: every bill, recurring and one-off. It is a number.
  - `monthly` / `yearly`: the sum of `expected_amount` over `kind = 'recurring'` bills with that
    `charge_frequency`. Null amounts and one-offs are excluded. The value is
    `formatAmount(sum, account.currency)`.
  - No bills → `{ "count": 0, "monthly": "0.00", "yearly": "0.00" }` (zero formatted at the
    currency's exponent). The value is never `null`.

## Steps

- [01 — Add the grouped summary query](backend/01-summary-query.md)
- [02 — Add the list-only handler hook and wire it into list()](backend/02-list-hook.md)
- [03 — Unit, e2e and integration specs](backend/03-specs.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)

## Notes

- **Zero formatting.** The issue says `"0.00"`, but amounts on the wire always follow the
  currency's exponent (`formatAmount`). A JPY provider therefore gets `"0"` and a BHD provider
  `"0.000"`. Use `formatAmount(0n, currency)` for consistency with `expected_amount`, and note
  it in the API spec. In the default BRL it is `"0.00"`, as the issue states.
- **Line limit.** `account.service.ts` has no room. Extract `#present` / `#presentOne` into a
  small `AccountPresenter` (or a similar helper) before adding the hook. Do not raise the lint
  limit.
- **In-memory e2e.** The in-memory repositories have no `createQueryBuilder`. Every bank e2e
  spec that lists `provider_expense` accounts needs a `jest.mock` of the new query module.
  Adding it to every bank e2e spec that builds the bank app is safest, because the class is a
  module provider.
- **No new cache code.** Invalidation already comes from `@OwnerScopedController('bank')` on
  `ProviderBillsController`. The new spec only pins that behavior.
- **No migration.** The feature is a read-only aggregate over existing columns.
