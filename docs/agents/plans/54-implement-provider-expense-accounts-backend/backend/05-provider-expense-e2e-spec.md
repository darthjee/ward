# Provider-expense e2e spec

Add `provider-expense-accounts.e2e-spec.ts`, modelled on `investment-accounts.e2e-spec.ts`,
covering the spec's *Required tests → Account routes* in both contexts (`/api/bank` and
`/api/orgs/:orgId/bank`):

- `GET ?type=provider_expense` lists only provider accounts, each with its `provider_expense`
  object; provider accounts never appear under the default / `regular`, `debt` or `investment`
  lists.
- Create with and without the object: `for_accountant` defaults to `true`,
  `charge_frequency` to `monthly`, unset fields `null`; without the object a details row still
  exists (detail returns the defaults).
- Detail and PATCH: partial merge, `null` clears optional fields, `null` on
  `charge_frequency` / `for_accountant` → `400`, `type` immutable (`400`), every row of the
  issue's paired-rule table, archived account → `409 ACCOUNT_ARCHIVED` for any
  `provider_expense` field (format errors still `400`).
- `400` cases: object on another type; `debt` / `investment` object on a provider account;
  `provider_expense: null`; `due_month` missing when yearly / present when monthly; `due_day`
  / `due_month` out of range; `expected_amount` ≤ 0, over the bound or with wrong decimals;
  `provider_tax_id` over 32; unknown keys.
- Currency change before any transaction rescales `expected_amount` (and `400` when not
  representable); with `expected_amount` in the same PATCH it is validated against the new
  currency.
- Name uniqueness: a provider "Vivo" clashes with a regular "Vivo" of the same owner → `409`.
- Ledger: a charge (negative) and a payment (positive) through the generic transaction routes;
  balance negative when owed, positive credit allowed; non-negative / positive opening balance
  accepted; charge differing from `expected_amount` accepted.
- Delete of an account with no transactions removes its details row (cascade in the harness).
- Owner isolation: another owner's / wrong-context / non-member `:orgId` ids → `404`.

## Files to Change

- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts` — new e2e spec.
