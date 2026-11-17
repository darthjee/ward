# Plan: Split provider — expand migration for provider bills

Issue: [121-split-provider-expand-migration-for-provider-bills.md](../../issues/121-split-provider-expand-migration-for-provider-bills.md)

## Overview
The expand step of epic #119. It renames `bank_bills` to `bank_provider_bills` and adds `kind` and
the recurring column group. It backfills one recurring bill per provider (plus hidden bills for
unscheduled providers that have past payments), and gives `bank_bill_payments` a per-bill identity
(`provider_bill_id` + three unique keys). The new migration has a pre-flight and a tolerant
`down`. The entity becomes `ProviderBill`. `bills.json` keeps its exact contract (one-offs only,
`amount`), and provider-expense create/PATCH writes through to the provider's single recurring
bill. Calendar, overdue, payment, history and accountant behaviour stays byte-identical.

All code lives in `backend/`. The spec updates under `docs/agents/specs/split-provider/` are
done by the architect, in the same PR (see the last step of the backend plan).

See [backend.md](backend.md) for the full plan.
