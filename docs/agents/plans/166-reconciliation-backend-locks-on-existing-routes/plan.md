# Plan: Reconciliation — backend: locks on existing routes

Issue: [166-reconciliation-backend-locks-on-existing-routes.md](../../issues/166-reconciliation-backend-locks-on-existing-routes.md)

## Overview

Apply the reconciliation locks from epic #85 to the existing bank routes. Transaction PATCH and
DELETE, the account PATCH (generic and typed), and the three bill-payment undos start taking the
common lock order (account, then statement, then transaction rows). They answer
`TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED` or the widened `CURRENCY_LOCKED`. The ledger and the
account detail expose the reconciliation fields. All the work is in `backend/`. After it,
`security` and `cache` review it (read-only). Navi does not change.

See [backend.md](backend.md) for the full plan.
