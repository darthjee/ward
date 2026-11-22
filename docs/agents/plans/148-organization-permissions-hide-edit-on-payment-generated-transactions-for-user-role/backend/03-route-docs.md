# Route docs

Document the new field in `docs/agents/backend/routes/bank.md`:

- Transaction response line (around line 274): add `payment_generated` to the listed fields, with
  a bullet: `true` when an owner-scoped bill payment references the transaction (payment,
  withdrawal or charge); always `false` on create.
- "Ledger envelope and pagination" (around lines 286-310): add `payment_generated` to the JSON
  example and a bullet saying it is computed per row in the ledger query, owner-scoped.
- The "Payment-generated transactions" paragraph (around lines 78-81): say that the responses
  expose the flag so the frontend can hide Edit, while the 403 stays the enforcement.

## Files to Change
- `docs/agents/backend/routes/bank.md` — transaction response, ledger envelope, payment-generated paragraph
