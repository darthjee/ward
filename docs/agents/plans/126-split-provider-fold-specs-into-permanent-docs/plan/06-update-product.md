# Update `product.md`

In `### bank` under *Implemented domain modules*, replace "bills are derived from debt /
provider-expense schedules, plus one-off bills" with two bullets:

- a provider-expense account holds N **provider bills** (recurring or one-off, immutable
  `kind`), each with its own schedule and default paying account. One provider still has one
  ledger, one balance and one accountant flag;
- debt bills are derived from the debt's schedule, and paying any bill writes ledger
  transactions in one DB transaction.

Mention epic [#119](https://github.com/darthjee/ward/issues/119) next to #26 as a deciding
epic.

## Files to Change
- `docs/agents/product.md` — `bank` bullets on bills.
