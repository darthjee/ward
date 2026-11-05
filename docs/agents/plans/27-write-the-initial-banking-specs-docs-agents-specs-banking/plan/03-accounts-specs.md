# Write the accounts specs

Create `docs/agents/specs/banking/accounts/`.

- `README.md` (owned by #27): the `Account` entity and its `type` enum (`regular`, `debt`,
  `investment`, `provider_expense`) as a decision; common concepts shared by all types (an
  account belongs to an organization; per-type details live in the type files); the rule that
  the main accounts list shows `regular` only, while debt and provider-expense accounts are seen
  in their own place (see `../ui/menu.md`); index of the type files. Ends with `## Reference`
  and `## Required tests` (none for the index; see each file).
- Stubs, each with "Owned by #NN", the relevant decided facts, an **Open questions** checklist,
  `## Reference`, and `## Required tests` → `TBD — defined by #NN`:
  - `regular.md` (#29): regular accounts and the common fields. Open questions: currency
    handling; categories; common field set.
  - `transactions.md` (#29): ledger and balances. Open questions: currency handling; categories;
    how balances are derived.
  - `debt.md` (#30): open questions include whether debt and provider-expense accounts share
    one submenu or get one each (`../ui/menu.md`), and whether debts generate bills (#33).
  - `investment.md` (#31): open question: whether investment accounts appear in the main
    accounts list.
  - `provider-expense.md` (#32): includes business expenses for the accountant. Open questions:
    shared vs. separate submenu with debt (`../ui/menu.md`); whether provider accounts generate
    bills (#33); how expenses are collected/sent to the accountant.

## Files to Change
- `docs/agents/specs/banking/accounts/README.md` — new: Account + type, common concepts, main list rule
- `docs/agents/specs/banking/accounts/regular.md` — new: stub owned by #29
- `docs/agents/specs/banking/accounts/transactions.md` — new: stub owned by #29
- `docs/agents/specs/banking/accounts/debt.md` — new: stub owned by #30
- `docs/agents/specs/banking/accounts/investment.md` — new: stub owned by #31
- `docs/agents/specs/banking/accounts/provider-expense.md` — new: stub owned by #32
