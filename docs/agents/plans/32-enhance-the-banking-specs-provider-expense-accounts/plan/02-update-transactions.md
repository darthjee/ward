# Minimal additions to transactions.md

`transactions.md` is #29's file; touch only the three spots the issue lists.

1. **Transaction entity table** — add a row before `createdAt` / `updatedAt`:
   `sentToAccountantAt` | no | no | nullable `DATETIME`; provider-expense charges only, set
   only by the accountant hand-off routes — see
   [provider-expense.md](provider-expense.md#business-expenses-for-the-accountant).
2. **"Bodies never accept"** bullet (Routes section) — add `sentToAccountantAt` to the list
   (`accountId`, `userId`, `organizationId`, `sentToAccountantAt` or computed fields), noting
   it is set only through the hand-off routes of provider-expense.md.
3. **Attachments bullet** — replace "out of scope for this spec (more relevant to the
   accountant flow of #32)" with a pointer to the new *Receipts / attachments*
   [Future epic](../README.md#future-epics).

Do not change anything else (indexes, ledger, routes table).

## Files to Change

- `docs/agents/specs/banking/accounts/transactions.md` — entity row, body whitelist bullet,
  attachments bullet.
