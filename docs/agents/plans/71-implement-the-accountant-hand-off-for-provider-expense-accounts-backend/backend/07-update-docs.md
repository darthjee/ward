# Update the docs
Update these docs in the same PR as the code, as the issue's *Docs* section requires. Do not
record the file layout in the spec.

1. **`docs/agents/specs/banking/accounts/provider-expense.md`.** Record each decision of #71 next
   to the rule it refines, marked "(decided in #71)":
   - the extra edge cases: unmarking on an unflagged account, sign flip, the today + 1 date
     limit, charges before `opening_date`, malformed ids → `400`;
   - which transactions the mark routes accept (other account types → `400`);
   - 404-before-400 precedence, and the `400` message naming the rejected ids;
   - the preview query rules: `include_sent` only `true` / `false`, `to − from` at most 366 days,
     `from == to` allowed, unknown parameters ignored;
   - the `FOR UPDATE OF t` row lock;
   - the `{ charges }` envelope with the nested `account`;
   - the mark routes' `200` reply;
   - `sent_to_accountant_at` absent (not `null`) outside provider charges.
2. **`docs/agents/specs/banking/accounts/transactions.md`** (`sentToAccountantAt` row). Add the
   exception: a `PATCH` that turns a sent charge positive also clears the mark.
3. **`docs/agents/backend/routes/bank.md`.**
   - Add `sent_to_accountant_at` to the transaction response and the ledger rows.
   - Add an *Accountant hand-off* section covering the three routes, query parameters, bodies,
     replies, caps, errors and cache classes.
   - In the intro, change "three thin resident controllers" to four, adding
     `AccountantController`.
4. **`docs/agents/backend/routes.md`.** The Bank line of the index gains "the accountant
   hand-off".
5. **`docs/agents/architecture/backend.md`** (`bank_transactions` row). Add the nullable
   `sent_to_accountant_at` `DATETIME` column, with no index.

## Files to Change
- `docs/agents/specs/banking/accounts/provider-expense.md` — #71 decisions
- `docs/agents/specs/banking/accounts/transactions.md` — sign-flip exception
- `docs/agents/backend/routes/bank.md` — response key, hand-off section, controller count
- `docs/agents/backend/routes.md` — Bank index line
- `docs/agents/architecture/backend.md` — new column
