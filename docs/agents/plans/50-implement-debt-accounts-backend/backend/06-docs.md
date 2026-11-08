# Documentation updates

**Owner: architect** (files under `docs/agents/`). Done after steps 01–05 so the docs match
the implementation.

- `docs/agents/specs/banking/accounts/debt.md` — record the two issue decisions (currency
  change rescales `instalment_amount`, 400 when unrepresentable; PATCH paired rules checked on
  the merged state, with the issue's examples) and the interest-rate output normalisation.
- `docs/agents/backend/routes/bank.md` — `type=debt` on list/create, the `debt` object
  (request rules + response example), its 400s, archived 409, `debt` on a non-debt account → 400.
- `docs/agents/specs/banking/accounts/regular.md` — reconcile line ~145 (POST table) and the
  edge case "Non-`regular` `type` on create → 400 until the other type specs exist": `debt` is
  now accepted; types without a handler still → 400.
- `docs/agents/architecture/backend.md` — add `bank_debt_details` to the table list (PK = FK
  to `bank_accounts.id`, `ON DELETE CASCADE`).
- `docs/agents/backend/routes.md` — check the index still reads correctly.

## Files to Change
- `docs/agents/specs/banking/accounts/debt.md`
- `docs/agents/backend/routes/bank.md`
- `docs/agents/specs/banking/accounts/regular.md`
- `docs/agents/architecture/backend.md`
- `docs/agents/backend/routes.md`
