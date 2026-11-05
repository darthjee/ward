# Update ui/menu.md and the banking README

Reflect the two specified files in the shared banking docs, touching only what #29 owns.

**`docs/agents/specs/banking/ui/menu.md`** — edit only the **Accounts** row (owned by #29):
status becomes **Specified**, and the "Shows" cell links to
[accounts/regular.md](../accounts/regular.md#accounts-submenu-ui) for the list / detail /
create / edit pages. Do not touch the other rows, the open question, or the Required tests
of other rows.

**`docs/agents/specs/banking/README.md`**:

- **Index** — update the descriptions of the `accounts/regular.md` and
  `accounts/transactions.md` rows (e.g. "Common account fields, regular accounts, archive vs
  delete, account routes, Accounts submenu pages" and "Ledger, opening anchor, computed
  balances, `Transaction` entity, currency, transaction and settings routes").
- **Sub-issue map** — optionally make the #29 row's file list descriptive, as #28's is.
- **Future epics** — append six numbered entries after the existing four (5–10), each tagged
  `(from [accounts/transactions.md](accounts/transactions.md#…))` or `regular.md` as
  appropriate, with enough detail to seed an epic, wording from the issue:
  Reconciliation, Linked transfers, Counterparty / payee, Currency conversion, Categories
  (likely shared with bills #33 and provider expenses #32), Ledger filters.

## Files to Change

- `docs/agents/specs/banking/ui/menu.md` — Accounts row only.
- `docs/agents/specs/banking/README.md` — index entries, (optionally) sub-issue map row for
  #29, six new Future epics entries.
