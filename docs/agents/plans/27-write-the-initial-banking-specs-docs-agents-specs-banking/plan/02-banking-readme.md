# Write the banking README

Create `docs/agents/specs/banking/README.md` (owned by #27), the entry point for the bank
feature spec.

Contents, in order:
1. Title plus a one-line naming note at the very top: folder is `banking`, module is `bank`.
2. Purpose and scope of the `bank` module (lazy tier): bank accounts, business expenses for the
   accountant, bills to pay — all scoped to organizations (link `../auth/README.md` as a
   dependency that must be implemented first).
3. Decisions: the `Account` entity with `type` (`regular`, `debt`, `investment`,
   `provider_expense`); main accounts list = `regular` only; the Bank menu shape (Accounts,
   debt/provider-expense place, Calendar); the organization-scoping announcement.
4. File index linking every file in the folder (`accounts/README.md`, `accounts/regular.md`,
   `accounts/transactions.md`, `accounts/debt.md`, `accounts/investment.md`,
   `accounts/provider-expense.md`, `bills.md`, `ui/menu.md`, `ui/calendar.md`).
5. Sub-issue → file map table: #28 → `../auth/organizations.md`; #29 → `accounts/regular.md`,
   `accounts/transactions.md`; #30 → `accounts/debt.md`; #31 → `accounts/investment.md`;
   #32 → `accounts/provider-expense.md`; #33 → `bills.md`, `ui/calendar.md`; #27 → the READMEs
   and `ui/menu.md` (whose rows each sub-issue edits). Add a line for the future implementation,
   fold and remove sub-issues of #26 (created later by the *Continue* split; the fold handles both
   `specs/banking/` and `specs/auth/`).
6. Rough implementation order: organizations first, then accounts (and their types), then bills
   and the calendar.
7. Note that there is no separate `api/` or `security.md` yet: each concern file holds its own
   routes, permissions and cache class, and can be split later.
8. `## Reference` (Epic #26 and sub-issue URLs, `specs.md`, `product.md` on GitHub) and
   `## Required tests` (none for the index; see each file).

## Files to Change
- `docs/agents/specs/banking/README.md` — new: banking spec overview, decisions, index, map, order
