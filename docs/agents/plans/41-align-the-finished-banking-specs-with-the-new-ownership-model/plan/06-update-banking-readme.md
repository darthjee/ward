# Update the banking README

Do **not** edit the "Bank ownership contract" (settled by #40).

- **Remove the "Realignment pending" note**; in its place keep one sentence: "#32 / #33 are
  written against the realigned specs (after #41)."
- **Index**: adjust the `regular.md` entry to mention "owner contexts (`<base>` / `<ui>`), per-owner
  name uniqueness, owner-context test matrix"; the `transactions.md` entry to note "settings
  routes in both contexts". Other entries only if their wording mentions organizations.
- **Sub-issue map**: the #41 row lists exactly what this issue edited —
  `accounts/README.md`, `accounts/regular.md`, `accounts/transactions.md`, `accounts/debt.md`,
  `accounts/investment.md`, `ui/menu.md`, the one-line owner fix in `accounts/provider-expense.md`
  and `bills.md`, and this `README.md` (realignment note, index entries, sub-issue map row,
  `## Future epics`). In the #40 row, leave "realignment note" (historical).
- **Future epics**:
  - *Linked transfers* (6): "between two accounts of the organization" → "between two accounts
    of the **same owner**; cross-owner transfers stay two manual transactions".
  - Add **15. Authorship / audit trail** (from [accounts/regular.md](accounts/regular.md#data-sensitivity--ownership))
    — record which member created or changed a record in an organization, without changing the
    single-owner rule (no owner semantics on the user reference; the #29 `createdByUserId` was
    dropped by #41).
- **Reference**: #41 is already listed; no change.

## Files to Change
- `docs/agents/specs/banking/README.md` — note, index, sub-issue map, Future epics.
