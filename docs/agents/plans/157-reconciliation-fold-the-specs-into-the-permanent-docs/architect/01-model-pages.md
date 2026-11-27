# Write the reconciliation concern page and update the bank model pages

Give reconciliation its own permanent concern page, as `provider-expense.md` has for the
accountant hand-off. Then rewrite the model pages that still describe the pre-reconciliation
world so they summarize it and link to the new page.

**New `docs/agents/modules/bank/reconciliation.md`** holds the lasting content of `README.md`
(overview, product decision table, scope, alternatives considered), `model.md` and the
decisions in `security.md`. Use the exact headings from the shared contract:

- intro (overview, product decision table, scope / out of scope);
- `## Reconciliation entity`: `bank_reconciliations` columns, states (`open` → `finished`, undo
  returns to `open`), and the nullable `bank_transactions.reconciliation_id` FK
  (`ON DELETE SET NULL`, the unique-open key);
- `## Formulas` with `### Queries and indexes` (cleared balance, difference, the
  `(account_id, statement_date)` index);
- `## Statement lifecycle`: start, tick / untick, eligibility, finish only at difference 0,
  cancel, undo of the latest finished statement only, chronological order;
- `## Lock matrix`: `amount` / `date` / delete of cleared rows, the opening anchor and currency
  locked once any statement exists, no bypass for `admin`;
- `## Migration`: the migration `20261123120027-bank-create-reconciliations` and backward
  compatibility;
- `## Concurrency`: the common lock order (account row, then transactions), shared by finish,
  transaction PATCH/DELETE and the payment undos;
- `## Memory`, and `## Data sensitivity and ownership` (roles, owner inherited through the
  account, response fields, input bounds);
- `## Mismatch surfacing` (the difference bar and the warning badge only), `## Alternatives
  considered` (including the rejected checkpoint anchors), `## Deferred` (step 03 fills in the
  epic URLs).

**`docs/agents/modules/bank/transactions.md`**: replace the "Editable and hard-deletable —
nothing is locked until reconciliation exists" bullet with the cleared-row rule: description and
notes stay editable, and `amount` / `date` / delete answer 409 `TRANSACTION_CLEARED`. Deleting a
ticked row drops the tick. A date moved out of the open statement's range unticks the row. Add
`reconciliationId` to the entity table and the `reconciliation` response field. In
§ Opening balance anchor, replace "Matching the ledger against the statement is the
Reconciliation epic (#85)" with a link to the new page, and add the anchor lock. Remove
"Reconciliation: #85" from § Deferred.

**`docs/agents/modules/bank/accounts.md`**: add statements / checkpoints per account (one open
statement at most, the history), the detail-only `last_reconciliation` /
`open_reconciliation_id` fields, the account-level locks (`ACCOUNT_RECONCILED` on the opening
fields, `CURRENCY_LOCKED` once any statement exists), and the fact that DELETE only ever
cascades zero-row statements.

**`docs/agents/modules/bank/bills.md`**: in § Paying, skipping and undoing, the three undos
answer 409 `TRANSACTION_CLEARED` when any linked transaction is cleared. An undo whose linked
transaction is only ticked deletes it along with its tick. Bill and provider-bill DELETE are
unchanged (already 409 when paid).

**`docs/agents/modules/bank/provider-expense.md`**: lines 122–125 and 182 say locking sent
charges "is left to Reconciliation (#85)". Rewrite them as shipped: the hand-off mark and the
cleared marker are independent. A sent charge stays editable unless it is cleared, and then the
lock matrix applies. Drop the `#85` deferred entry.

**`docs/agents/modules/bank.md`**: add `Reconciliation` / `bank_reconciliations` to
§ Entities, add `ReconciliationsController` to § Routes (ten resident controllers), and link
`bank/reconciliation.md` from § Index.

## Files to Change
- `docs/agents/modules/bank/reconciliation.md` — new concern page (contract headings)
- `docs/agents/modules/bank/transactions.md` — cleared rows, lock, removal of the "editable and hard-deletable" statement
- `docs/agents/modules/bank/accounts.md` — statements per account, account-level locks
- `docs/agents/modules/bank/bills.md` — payment undo vs cleared rows
- `docs/agents/modules/bank/provider-expense.md` — sent charges vs cleared lock, drop #85 deferral
- `docs/agents/modules/bank.md` — entity, controller, index link
