# Spec docs update (architect)

`docs/agents/` is owned by the architect. The backend agent reports its final decisions (key and
index names, the payment-identity choice, and the description sync), and the architect updates
the specs in the same PR:

- `docs/agents/specs/split-provider/migration.md`:
  - Replace "One transaction" with the non-atomic explanation, the pre-flight-first order and
    the tolerant `down`.
  - Add the hidden-bill backfill for unscheduled providers with past payments.
  - Add the cleared-schedule write-through rule (hide, never delete) and the description sync.
  - In "Transition rules", say the `409 PROVIDER_HAS_MULTIPLE_BILLS` lands in #122.
  - Add "new provider payments get `provider_bill_id`" from #121.
  - Update the "Required tests" for #121.
- `docs/agents/specs/split-provider/model.md`: note the hidden recurring bills
  (`show_in_calendar = false` from the backfill) where the model is touched.
- `docs/agents/modules/bank/bills.md` and `docs/agents/modules/bank/provider-expense.md`: rename
  the table to `bank_provider_bills`, describe `amount` ↔ `expected_amount`, the one-off-only
  legacy routes and the write-through.

## Files to Change
- `docs/agents/specs/split-provider/migration.md` — corrections listed above.
- `docs/agents/specs/split-provider/model.md` — hidden bills.
- `docs/agents/modules/bank/bills.md`, `docs/agents/modules/bank/provider-expense.md` — table and column rename, legacy-route behaviour.
