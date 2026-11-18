# Plan: Split provider — provider-bills CRUD API

Issue: [122-split-provider-provider-bills-crud-api.md](../../issues/122-split-provider-provider-bills-crud-api.md)

## Overview

Add the five `provider-bills` routes (on both `/bank` and `/orgs/:orgId/bank`) so a
`provider_expense` account can hold several recurring bills and one-off bills. Gate the #121
schedule write-through, add `409 PROVIDER_HAS_MULTIPLE_BILLS`, and rescale every bill on a provider
currency change. All code work is owned by `backend`.

See [backend.md](backend.md) for the full plan.

## Notes (architect, cross-cutting)

- **Spec and doc updates in the same PR** (architect scope, `docs/agents/`), to be applied after
  `backend` finishes:
  - `docs/agents/specs/split-provider/migration.md`: the write-through runs only when a schedule
    field is sent and the provider has at most one recurring bill. The description sync runs only
    when `name` changes and only with exactly one recurring bill. A name-only `PATCH` never
    re-creates a deleted recurring bill.
  - `docs/agents/specs/split-provider/model.md` ("Description uniqueness"): change
    "accent-sensitive" to **accent-insensitive** (`utf8mb4_0900_ai_ci`, so `"Água"` = `"agua"`).
  - `docs/agents/specs/split-provider/api/provider-bills.md`:
    - Record the `PATCH bills/:id.json` move rules as an intended correctness fix.
    - `expected_amount` is a decimal string on the wire, stored in minor units.
    - Currency change re-checks every bill's `paying_account_id`.
    - `bills.json` keeps `BILL_PAID` and its `422 ACCOUNT_NOT_FOUND` for unknown or foreign targets.
  - `docs/agents/modules/bank/bills.md`, `docs/agents/modules/bank/provider-expense.md`,
    `docs/agents/backend/routes/bank.md`: add the new routes, error codes and transition rule.
- **Reviews:**
  - `security`: new endpoints, user input, and owner-scoped resolution. Dispatch it with the
    changed files once `backend` finishes.
  - `data-access`: new response fields.
  - `cache`: `@CachePolicy` declarations only. Navi warms none of these routes, so nothing under
    `navi/` changes.
- No frontend (#124), proxy or infra change.
