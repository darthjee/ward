# Issue: Organization permissions: hide Edit on payment-generated transactions for user role

## Description
After #144, a `user` still sees the **Edit** button on ledger rows created by a payment (paying a bill or a provider bill). These are the payment, withdrawal and charge transactions that a `bank_bill_payments` row references. The backend's record-dependent check (#143, `TransactionService` → `PaymentGeneratedQuery.isPaymentGenerated`) rejects the save with a 403, and the UI then shows "You don't have permission to do this".

## Problem
The ledger response does not say whether a row is payment-generated, so `LedgerTableHelper.jsx` has to offer Edit on every row. A `user` can open the edit form, fill it in and only find out on save that they were never allowed to. #145 records this as a known limitation in `docs/agents/architecture/frontend.md`.

## Expected Behavior
- A `user` does not see Edit on payment-generated ledger rows. They still see Edit on ordinary rows.
- `admin` and `owner` keep seeing Edit on every row.
- The backend 403 stays as the real enforcement. Hiding the button is only UX.

## Solution
- **Backend**: add a boolean `payment_generated` to each ledger row and to the single-transaction response (POST/PATCH), so the transaction shape is the same everywhere. For a single transaction, reuse `isPaymentGenerated`. For ledger rows, compute it in the ledger query, in the same set-based way `isPaymentGenerated` works: an owner-scoped `EXISTS` against `bank_bill_payments` on the payment, withdrawal or charge transaction id, joined through the source account. Do not run one query per row. Update the route docs (`docs/agents/backend/routes/bank.md`) and the response specs.
- **Frontend**: in `LedgerTableHelper.jsx`, show Edit only when the row is not payment-generated or the role may edit payment-generated transactions (the `can(role, ...)` helper from #144). Update the helper's JSDoc and the Jasmine specs. Out of scope: any visible marker or badge on payment-generated rows.
- **Docs**: remove the known-limitation note added by #145 in `docs/agents/architecture/frontend.md`, and add Edit on payment-generated rows to the list of hidden controls.

## Benefits
- `user` no longer hits a dead-end edit that always fails.
- The UI matches the backend permission rules, which closes the last gap left by #144/#145.
