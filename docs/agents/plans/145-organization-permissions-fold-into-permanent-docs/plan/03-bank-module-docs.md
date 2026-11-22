# Bank module docs
State the role each bank action needs and remove the "not enforced until #81" notes.

- **`modules/bank.md`** — "Permissions" bullet: Personal = owner (counts as `owner`); in an
  organization, reads open to every member, everyday writes (transactions, bills, payments,
  accountant marks) for `user`+, deletes, payment undo and account structure (create, edit,
  archive, unarchive, delete) for `admin`+, nothing owner-only. Link the route table.
- **`modules/bank/bills.md`** (rule 4) — replace "every member sees, edits and pays every bill
  (roles not enforced until #81)" with: every member sees; `user` creates, edits and pays /
  skips; deleting a bill and undoing a payment need `admin`.
- **`modules/bank/provider-expense.md`** — same replacement for provider bills (create/edit/pay
  `user`; delete and undo `admin`; provider account structure `admin`).
- **`modules/bank/accounts.md`** — "Who sees and edits" ("every member, with equal rights") →
  role-based; account create/edit/archive/unarchive/delete need `admin`. Drop the #81 Deferred
  line.
- **`modules/bank/transactions.md`** — add: create/edit `user`, delete `admin`; editing a
  payment-generated transaction needs `admin` (record-dependent check), with the #148 known
  limitation.
- **`modules/bank/ui.md`** — short note of which controls are hidden for `user` and the
  `PermissionDenied` pages, linking to [Frontend → Owner context](../../architecture/frontend.md#owner-context-organizations)
  rather than duplicating.

## Files to Change
- `docs/agents/modules/bank.md` — permissions bullet
- `docs/agents/modules/bank/bills.md` — rule 4
- `docs/agents/modules/bank/provider-expense.md` — organization-context bullet
- `docs/agents/modules/bank/accounts.md` — who sees and edits; Deferred list
- `docs/agents/modules/bank/transactions.md` — role per action, payment-generated rule
- `docs/agents/modules/bank/ui.md` — role-gated controls pointer
