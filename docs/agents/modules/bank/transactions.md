# Bank — Transactions

The **ledger** every account carries, how its **balance** is obtained, the `Transaction`
entity, **currency** handling and the bank **settings**. Part of the
[Bank module](../bank.md); the account fields and rules are in [accounts.md](accounts.md).

Endpoints: [Routes — Bank → Transactions](../../backend/routes/bank.md#transactions) and
[Settings](../../backend/routes/bank.md#settings).

## Ledger

- Every account type carries the same ledger: an opening anchor plus `Transaction` rows. Each
  type gives the sign its own meaning (see [debt.md](debt.md),
  [investment.md](investment.md), [provider-expense.md](provider-expense.md)).
- Transactions belong to one account and inherit its owner; they never store a copy.
- **Order** — newest first; within a day by `id`, newest first; no manual reordering. The
  virtual opening row is always the oldest row.
- **Pagination** — 50 rows per page with a `pagination` block (`page`, `per_page`,
  `total_pages`, `total_count`). The ledger was the project's first paginated route, and its
  block is the convention for later ones (bills, bill history).
- **Running balance** — computed per row with a MySQL 8 window function over the account's
  whole ledger **before** the `LIMIT`, so it stays correct across pages.

Filtering the ledger by date or text is the *Ledger filters* epic
([#90](https://github.com/darthjee/ward/issues/90)).

## Balance

- **Balances are computed, never stored** — derived in SQL on read.
- **Current balance** = `openingBalance` + SUM(transactions dated on or after `openingDate`).
- The account list gets every balance from one `SUM … GROUP BY account_id` query (no N+1).
- A stored or cached balance is only a possible future optimisation.

### Opening balance anchor

The opening balance is an **anchor**, not an amount: the user records a known fact, "at the
start of `openingDate` the balance was `openingBalance`" (start of day, before any transaction
dated that day).

- Stored as two fields on `Account`, `openingDate` (`DATE`) and `openingBalance` (integer minor
  units). Set on create, edited through the account `PATCH`, never deletable: exactly one per
  account by construction.
- The ledger renders a **virtual opening row**, always the oldest row whatever its date, with
  the derived amount `openingBalance − SUM(transactions dated before openingDate)`. It is
  returned as `opening` on the last ledger page only.
- So **backfilling never changes balances from the anchor onward**; only the history before it
  adjusts, with no bookkeeping on writes.

Example: an account is started with an anchor of 10,000 on 1 Nov. October is then backfilled
(+15,000, −10,000). The opening row becomes 5,000, the ledger reads 5,000 → 20,000 → 10,000,
and the balance on 1 Nov is still 10,000.

**Known trade-off** — a wrongly backfilled transaction is silently absorbed into the history
before the anchor, instead of surfacing as a mismatch against the bank statement. Matching the
ledger against the statement is the *Reconciliation* epic
([#85](https://github.com/darthjee/ward/issues/85)).

### Future-dated transactions

Not allowed: a transaction date may be at most **UTC today + 1 day**, so each account has a
single balance. "What's coming" is covered by [bills](bills.md). A current vs projected balance
is the *Projected balance* epic ([#104](https://github.com/darthjee/ward/issues/104)); allowing
future-dated transactions later needs no data migration.

## Transaction entity

`Transaction` (`bank_transactions`):

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `accountId` | yes | no | From the URL; a transaction never moves between accounts |
| `date` | yes | yes | `DATE`, at most UTC today + 1 day |
| `amount` | yes | yes | Signed: positive = money in, negative = money out; zero rejected |
| `description` | yes | yes | Trimmed, non-blank, at most 255 characters |
| `notes` | no | yes | At most 2000 characters |
| `sentToAccountantAt` | no | no | Nullable `DATETIME`, provider-expense charges only, set and cleared by the [accountant hand-off](provider-expense.md#accountant-hand-off) |
| `createdAt` / `updatedAt` | — | — | |

- **Editable and hard-deletable** — nothing is locked until reconciliation exists
  ([#85](https://github.com/darthjee/ward/issues/85)).
- An **archived account's** transactions are read-only: create, edit and delete answer 409
  `ACCOUNT_ARCHIVED`.
- **No `kind` column** — the sign and the description say what a transaction is (payment,
  interest, yield, charge). The type shortcuts in the UI only pre-fill an ordinary transaction.
- Bodies never accept `accountId`, owner fields, `sentToAccountantAt` or computed fields
  (`balance`); unknown fields → 400.
- **Index** `bank_transactions (account_id, date, id)` serves the ledger order, the running
  balance, the derived opening and the balance.

Deferred: *Linked transfers* ([#86](https://github.com/darthjee/ward/issues/86)) — a transfer
between two accounts of the same owner as one linked pair; until then a transfer is two
independent manual transactions. *Counterparty / payee*
([#87](https://github.com/darthjee/ward/issues/87)). Receipts on transactions are the
*Receipts / attachments* epic ([#96](https://github.com/darthjee/ward/issues/96)).

## Currency

- **One currency per account**, an ISO 4217 code chosen at creation; transactions carry none of
  their own. A purchase in another currency is entered at the amount that left the account.
- **Editable only while the account has no transactions**; afterwards a change answers 409
  `CURRENCY_LOCKED` (create a new account instead). A change before any transaction keeps the
  decimal value of the opening balance and of the type's stored amounts (instalment, expected
  amount), and answers 400 when one can't be represented in the new exponent.
- **Supported list** — the full ISO 4217 list from `Intl.supportedValuesOf('currency')`; no
  table to maintain.
- **Default** — `BANK_DEFAULT_CURRENCY` (default `BRL`), validated at boot as a supported code
  (see [Environment Variables](../../environment-variables.md)). It applies when a create
  omits `currency` and pre-fills the create forms through [`settings.json`](#settings).
- **Integer minor units** — amounts are stored as `BIGINT` in the currency's own exponent
  (BRL/USD 2, JPY 0, BHD 3, from `Intl.NumberFormat`). No floats.
- **Decimal strings in the API** — for example `"-1234.56"`, `"500"` for JPY. More decimals than
  the currency allows → 400.
- **Bound** — `|amount|` at most 10¹³ minor units; larger → 400.
- **No conversion** — aggregates across accounts are grouped per currency, never summed. Showing
  totals across currencies is the *Currency conversion* epic
  ([#88](https://github.com/darthjee/ward/issues/88)).

## Categories

Not built. `Transaction` has no `categoryId`; adding a nullable one later needs no backfill.
Categorising transactions (and telling a provider refund apart from a payment) is the
*Transaction categories* epic ([#89](https://github.com/darthjee/ward/issues/89)).

## Settings

`GET <base>/settings.json` answers `{ "default_currency": "BRL" }` from
`BANK_DEFAULT_CURRENCY`, with the same value under both prefixes. It stays owner-scoped (a
non-member `:orgId` → 404) rather than public, so every bank route follows the ownership
contract with no exception. It reads the resident config and does not load the lazy module.

## Alternatives considered

- **Stored balance** — rejected in favour of a computed balance.
- **Opening as a real transaction row** — rejected in favour of anchor fields on `Account`.
- **`DECIMAL` amounts** — rejected in favour of integer minor units.
- **Curated currency list** — rejected in favour of the full ISO list from `Intl`.
- **Modal or separate-page transaction entry** — rejected in favour of inline entry in the
  ledger.
- **Public settings route** — rejected in favour of an owner-scoped `settings.json`.

## Deferred

- Reconciliation: [#85](https://github.com/darthjee/ward/issues/85)
- Linked transfers: [#86](https://github.com/darthjee/ward/issues/86)
- Counterparty / payee: [#87](https://github.com/darthjee/ward/issues/87)
- Currency conversion: [#88](https://github.com/darthjee/ward/issues/88)
- Transaction categories: [#89](https://github.com/darthjee/ward/issues/89)
- Ledger filters: [#90](https://github.com/darthjee/ward/issues/90)
- Projected balance: [#104](https://github.com/darthjee/ward/issues/104)

## Differences from the original spec

- **`sent_to_accountant_at`** is present only on provider-expense charges; on every other
  transaction and ledger row the key is **absent**, not `null`
  ([#71](https://github.com/darthjee/ward/issues/71)).
- A `PATCH` that turns a sent charge positive (a payment) clears its mark
  ([#71](https://github.com/darthjee/ward/issues/71)).
- **Within a day**, rows are ordered by `id` newest first (the spec said "by insertion order").
- A ledger page past the last answers `transactions: []` and `opening: null`; `total_pages` is
  at least 1.
