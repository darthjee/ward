# Update accounts/README.md, ui/menu.md and the #27 stubs

**`accounts/README.md`**
- "An account belongs to an organization …, never directly to a user" → "An account has exactly
  one owner — the user (Personal) or an organization — and every child record inherits it (see
  the [Bank ownership contract](../README.md#bank-ownership-contract))".
- Add to the Reference section the #40 / #41 links. Required tests stay "None for this index".

**`ui/menu.md`**
- Add a short **Context** bullet under Decisions:
  - the menu is the same in every context (Personal or an organization); its links resolve under
    the active context's prefix (`/bank/...` or `/orgs/:orgId/bank/...`); the switcher itself is
    specified in [auth/organizations.md](../../auth/organizations.md#active-context);
  - switching context lands on the **same section's list** in the new context (Accounts / Debts /
    Investments), never the same record id (which would 404);
  - with zero organizations the bank menu and pages work fully in Personal.
- Do not touch the submenu table rows (their anchors `#accounts-submenu-ui`, `#debts-submenu-ui`,
  `#investments-submenu-ui` are unchanged).
- Required tests: add — menu links built from the active context in both contexts; switching
  context lands on the same section's list; a user with zero organizations uses the whole bank
  module in Personal.

**#27 stubs — one line each, nothing else**
- `accounts/provider-expense.md`: "It belongs to an organization." → "It inherits the owner from
  its account."
- `bills.md`: "Bills belong to an organization." → "Bills inherit the owner from their account."

## Files to Change
- `docs/agents/specs/banking/accounts/README.md` — ownership bullet, references.
- `docs/agents/specs/banking/ui/menu.md` — context bullet, tests.
- `docs/agents/specs/banking/accounts/provider-expense.md` — one line.
- `docs/agents/specs/banking/bills.md` — one line.
