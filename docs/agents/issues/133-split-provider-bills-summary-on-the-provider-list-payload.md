# Issue: Split provider — bills_summary on the provider list payload

## Description

Part of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119). Blocks [#131](https://github.com/darthjee/ward/issues/131) (frontend provider bills management UI). Found while enhancing [#124](https://github.com/darthjee/ward/issues/124).

The provider list column becomes `3 bills · R$ 250,00 / month + R$ 1.200,00 / year` (rules in `docs/agents/specs/split-provider/ui/provider-bills.md` § Provider list column).

## Problem

Today the only source for those numbers is `GET <base>/accounts/:accountId/provider-bills.json`, which is paginated at 50 per page. Using it would take at least one request per provider row.

## Expected Behavior

`GET <base>/accounts.json?type=provider_expense` (Personal and organization contexts, active and archived lists) returns each `provider_expense` account with:

```json
"bills_summary": { "count": 3, "monthly": "250.00", "yearly": "1200.00" }
```

- `count`: every bill of the provider, recurring and one-off.
- `monthly` / `yearly`: the sum of `expected_amount` over **recurring** bills with that `charge_frequency`, as decimal strings in the provider's currency. One-offs and recurring bills with a null `expected_amount` are excluded from the sums.
- Archived providers carry it too. It never exposes owner or organization ids.
- When there is nothing to sum for a frequency, the value is `"0.00"` (never `null`); a provider with no bills gets `{ "count": 0, "monthly": "0.00", "yearly": "0.00" }`.
- Other account types do not carry the field.
- List only: the single-account GET (`accounts/:accountId.json`) does not carry `bills_summary`.

## Solution

- Backend: compute the summaries in one aggregate query (grouped by provider account) over all provider accounts the list returns, with no N+1. `accounts.json` is not paginated, so the query covers the whole list. Attach the result through the provider-expense handler's list serialization.
- Cache: the cache class stays user-scoped, like the list. Invalidation needs no new code: `ProviderBillsController` is an `@OwnerScopedController('bank')`, so its writes already clear the owner's whole `bank` subtree, which includes `accounts.json`. The `cache` agent should confirm this, and a spec should pin it.
- Docs: update `docs/agents/specs/split-provider/api/provider-bills.md` and `ui/provider-bills.md` (§ Provider list column) to reference the field.
- Owners: `backend`, plus `cache` (invalidation check) and `data-access` (review of the new response field).

## Benefits

The provider list renders the Bills column from a single request, which unblocks #131.
