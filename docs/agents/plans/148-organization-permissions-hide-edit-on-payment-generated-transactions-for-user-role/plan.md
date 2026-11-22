# Plan: Organization permissions: hide Edit on payment-generated transactions for user role

Issue: [148-organization-permissions-hide-edit-on-payment-generated-transactions-for-user-role.md](../../issues/148-organization-permissions-hide-edit-on-payment-generated-transactions-for-user-role.md)

## Overview

The backend adds a boolean `payment_generated` to every ledger row and to the single-transaction
response (POST/PATCH), so the transaction shape is the same everywhere. The frontend uses it to
hide Edit on payment-generated rows for a `user`, through the existing
`ACTIONS.EDIT_PAYMENT_TRANSACTION` permission. The backend 403 stays as the real enforcement;
hiding the button is only UX. The backend ships first, then the frontend consumes the field.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

- **Ledger row** (`GET` ledger envelope, each item of `transactions`): new field
  `payment_generated: boolean` (never `null`). It is `true` when an owner-scoped
  `bank_bill_payments` row references the transaction as its `payment_transaction_id`,
  `withdrawal_transaction_id` or `charge_transaction_id`. The check joins through the payment's
  source account (`bank_accounts a ON a.id = p.source_account_id`) and is filtered by the active
  owner (`ownerSqlWhere(owner, 'a')`), so a payment from another owner counts as `false`.
  Example row:

  ```json
  { "id": 12, "date": "2026-11-01", "amount": "-150.00", "description": "Electricity",
    "notes": null, "sent_to_accountant_at": null, "payment_generated": true, "...": "..." }
  ```

- **Single-transaction response** (`POST` create and `PATCH` update): same new field
  `payment_generated: boolean`. On create it is always `false` (a new transaction cannot be
  referenced by a bill payment yet). On update it comes from
  `PaymentGeneratedQuery.isPaymentGenerated(owner, id)`.
- The field is snake_case in JSON. The frontend reads `transaction.payment_generated` directly;
  there is no client-side camelCase mapping.
- Frontend rule: Edit is shown when `!transaction.payment_generated || can(role,
  ACTIONS.EDIT_PAYMENT_TRANSACTION)`. `EDIT_PAYMENT_TRANSACTION` already exists in
  `frontend/assets/js/utils/permissions/orgPermissions.js` and needs `admin` or above, matching
  the backend's `TransactionService` check.

## Review and documentation (outside the specialist plans)

- `cache` confirms the cache classes are unchanged: the ledger GET stays user-scoped
  (`X-Cache-Allow`, not warmed by Navi) and the writes stay `X-Skip-Cache`. No Navi change.
- `security` and `data-access` review the new response field. It only exposes whether the
  caller's own owner has a bill payment that references the transaction, so it must stay
  owner-scoped.
- `architect` updates `docs/agents/architecture/frontend.md` in the same PR:
  - remove the "Known limitation" bullet that points at #148;
  - in "Hidden controls for `user`", replace "the ledger's transaction Delete (Edit stays)"
    with the ledger's transaction Delete and the Edit of payment-generated transactions
    (`EDIT_PAYMENT_TRANSACTION`; Edit stays on ordinary rows).
