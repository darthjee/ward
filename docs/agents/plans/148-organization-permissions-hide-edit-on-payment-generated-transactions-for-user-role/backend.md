# Backend Plan: Organization permissions: hide Edit on payment-generated transactions for user role

Main plan: [plan.md](plan.md)

## Shared contracts

The backend must produce:

- `payment_generated: boolean` (never `null`) on every ledger row in the ledger envelope's
  `transactions` list.
- `payment_generated: boolean` on the POST (create) and PATCH (update) transaction responses.
  Create is always `false`. Update uses `PaymentGeneratedQuery.isPaymentGenerated(owner, id)`.
- "Payment-generated" means: an owner-scoped `bank_bill_payments` row references the
  transaction as `payment_transaction_id`, `withdrawal_transaction_id` or
  `charge_transaction_id`, joined through `bank_accounts a ON a.id = p.source_account_id`, and
  filtered with `ownerSqlWhere(owner, 'a')`. A payment from another owner counts as `false`.

## Steps

- [01 — Ledger rows carry payment_generated](backend/01-ledger-payment-generated.md)
- [02 — Single-transaction response carries payment_generated](backend/02-transaction-response-payment-generated.md)
- [03 — Route docs](backend/03-route-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job:
  `backend_integration`)
- `backend`: `docker-compose run --rm ward_tests yarn lint_fix` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn typecheck` (CI job: `backend_typecheck`)
- `backend`: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)

## Notes

- Do not run one query per ledger row. The ledger computes the flag with a correlated `EXISTS`
  in the same SQL that builds the page.
- The backend 403 in `TransactionService.#assertMayEdit` stays exactly as it is. This issue only
  adds information to responses.
- No migration is needed. If `EXPLAIN` shows the `EXISTS` scanning `bank_bill_payments`, check
  that the three transaction-id columns are indexed (they are foreign keys, so MySQL normally
  has indexes on them already). Only add a migration if one is missing.
