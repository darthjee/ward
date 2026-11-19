# Plan: Split provider — bills_summary on the provider list payload

Issue: [133-split-provider-bills-summary-on-the-provider-list-payload.md](../../issues/133-split-provider-bills-summary-on-the-provider-list-payload.md)

## Overview

Add a top-level `bills_summary: { count, monthly, yearly }` to every `provider_expense` account
returned by `GET <base>/accounts.json?type=provider_expense` (Personal and organization, active
and archived lists). The values come from one grouped query over all listed provider accounts,
so there is no N+1. The single-account GET and the other account types do not get the field. All
code changes are in `backend/`. No migration is needed.

See [backend.md](backend.md) for the full plan.

## Review and documentation (outside the backend plan)

- `cache` confirms that the list stays `user-scoped` (inherited from `OwnerScopedController`), and
  that the provider-bill writes already invalidate `/bank` or `/orgs/:id/bank`, which covers
  `accounts.json`. Navi warms nothing new.
- `data-access` reviews the new response field. It holds only aggregates and never owner or
  organization ids.
- `architect` updates the docs in the same PR:
  - `specs/split-provider/api/provider-bills.md`: add a `bills_summary` section with the shape,
    the rules (count covers every bill; sums cover only recurring bills with a non-null
    `expected_amount`, split by `charge_frequency`; zero is formatted at the currency's exponent
    and is never `null`; list only), and the invalidation note.
  - `specs/split-provider/ui/provider-bills.md` § Provider list column: it already reads from
    `bills_summary`. Link it to the API section.
  - `backend/routes/bank.md`: the `GET accounts.json` row and the Provider-expense object section
    should mention `bills_summary` on `provider_expense` list items.
