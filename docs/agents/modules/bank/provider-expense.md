# Bank — Provider-expense accounts

A provider-expense account is an `Account` with `type` `provider_expense`: **one account per
provider** (an energy company, an ISP, a software vendor), tracking what the provider charges
and what is paid to it. It also carries the **business expenses for the accountant**. It reuses
[accounts.md](accounts.md) and [transactions.md](transactions.md). Part of the
[Bank module](../bank.md).

Endpoints: [Routes — Bank → Provider-expense object](../../backend/routes/bank.md#provider-expense-object)
and [Accountant hand-off](../../backend/routes/bank.md#accountant-hand-off).

## Payable ledger

- A **charge** (what the provider bills) is a **negative** transaction; a **payment** to the
  provider is **positive**.
- The **balance** is what is still owed: `0` = settled, negative = owed, positive = credit with
  the provider (allowed, no warning).
- **Opening anchor** = the amount outstanding when recording starts, usually `0`; any sign is
  allowed.
- A balance at or above zero is nothing special (a provider is an ongoing relationship).
- No `kind` column, no charge ↔ payment link. The **Add charge** / **Add payment** shortcuts
  only pre-fill the inline form (see [ui.md](ui.md#providers)).
- Paying a provider from a regular account is two manual transactions, or a bill payment (see
  [Charges and bills](#charges-and-bills)).

## Fields

The common fields apply, with provider labels and no new columns: `bankName` is the
**provider**, `accountNumber` is the **customer / contract number** (still masked), `branch`
stays optional.

Provider fields in `bank_provider_expense_details` (1:1, `account_id` PK and FK, `ON DELETE
CASCADE`, no owner columns):

| Field | Type | Notes |
|---|---|---|
| `forAccountant` | boolean, not null, default `true` | Whether the account's charges are business expenses |
| `providerTaxId` | free text, at most 32 | The provider's tax id (CNPJ…); trimmed, blank → `null`, no format check; shown in full (a business's public identifier) |
| `expectedAmount` | `BIGINT` minor units, > 0 | Typical charge; suggested by **Add charge**; the bill's expected amount |
| `chargeFrequency` | `monthly` \| `yearly`, not null | Default `monthly` |
| `dueDay` | int 1–31 | 29–31 clamp to the month's end (see [bills.md](bills.md#recurrence)) |
| `dueMonth` | int 1–12 | Required when `yearly`, rejected when `monthly` |

Plus the bill [schedule fields](bills.md#schedule-fields). `dueDay` / `dueMonth` mirror the
debt names, so bills read one shape from both types.

### Rules

- A provider-expense account always has a details row (`for_accountant` `true`,
  `charge_frequency` `monthly`, the rest `null`).
- `for_accountant` and `charge_frequency` never accept `null`; every other field does, to clear
  it.
- The `charge_frequency` ↔ `due_month` pair is checked on the stored details (or the defaults,
  on create) with the request merged on top; switching to `monthly` clears `due_month`
  ([#54](https://github.com/darthjee/ward/issues/54)).
- A currency change (only before any transaction) rescales the stored `expected_amount`
  (`200.00` BRL → `200` JPY; `12.50` BRL → JPY → 400), unless the same PATCH sends one.
- On an archived account, any `provider_expense` field → 409 `ACCOUNT_ARCHIVED`.

## Accountant hand-off

### What counts

- Every **charge** (negative transaction) of a `forAccountant` account is a business expense;
  **payments never are**.
- The hand-off works in Personal and in organizations; each covers only the **active owner**.
- Archived accounts are included, and so are charges dated before the account's
  `opening_date`.

### Preview and CSV

- The **preview** lists the charges of every `forAccountant` account of the active owner in a
  date range, ordered by date then id. By default only **unsent** charges; `include_sent=true`
  adds the sent ones.
- Each row carries the charge (`id`, `date`, `description`, `amount`,
  `sent_to_accountant_at`) and a nested `account` with only `id`, `name`, `bank_name`,
  `provider_tax_id` and `currency` (no owner fields, no account number, no balance).
- The **CSV is built client-side** from exactly the previewed rows: no CSV route, no backend
  memory, no dependency. Format:
  - UTF-8 **with BOM** (accents in Excel), comma-separated, **CRLF** line endings, `.` decimal
    point, ISO dates;
  - header `Date,Account,Provider,Provider tax id,Description,Amount,Currency` (account name
    and `bank_name` in their own columns);
  - every field quoted, embedded quotes doubled; `amount` is the API string;
  - **formula-injection guard** (OWASP): text cells starting with `=`, `+`, `-`, `@`, tab or
    carriage return get a leading `'`; the numeric amount column is not prefixed;
  - filename `ward-accountant-<from>-<to>.csv`, with no owner or organization name.
- Any totals are **per currency**, never summed.

### Marking as sent

- **Mark as sent** is an explicit action, never automatic on download. It posts **exactly the
  previewed ids**, never a re-evaluated range, and stamps `sentToAccountantAt`.
- Re-marking is idempotent and keeps the original timestamp. **Mark as unsent** clears it (a
  per-charge undo on the provider detail page).
- **All-or-nothing** — the ids are resolved in one owner-scoped query that locks the
  transaction rows (`SELECT … FOR UPDATE OF t`) inside one DB transaction:
  - any unknown, foreign or wrong-context id → 404, checked first, so nothing is revealed about
    ids the owner can't see;
  - `mark-sent`: a payment, a charge of a `forAccountant`-off account or another account type
    → 400 naming the rejected ids;
  - `mark-unsent`: only payments and other account types → 400, so marks kept after
    `forAccountant` was turned off stay undoable;
  - nothing changes on any error.
- **Archived accounts** — marking is allowed (hand-off metadata, not a ledger edit); this is
  the one exception to the archived read-only rule.
- **Editing or deleting a sent charge** is allowed with a warning in the UI; an edit keeps the
  mark, and a PATCH that turns the charge positive clears it (a payment is never marked).
  Locking sent charges is left to *Reconciliation*
  ([#85](https://github.com/darthjee/ward/issues/85)).
- Turning `forAccountant` off keeps existing marks; the account just leaves future previews.

### Caps

Checked in this order by the preview: the dates (`from` / `to` required, `from` ≤ `to`, neither
after UTC today + 1 day), then the range (`to − from` ≤ **366** days), then the rows (more than
**1000** charges → 400 "narrow the range", never a partial list). The mark routes take 1 to
**1000** ids. There is no rate limit (authenticated users in their own context).

### Refunds

**Not exported.** A refund and a payment are both positive transactions and nothing tells them
apart, so the hand-off exports charges only. Until the *Transaction categories* epic
([#89](https://github.com/darthjee/ward/issues/89)) can mark a refund, the user reports it to
the accountant outside Ward.

### Receipts and attachments

No uploads, no file storage, no attachments on charges or exports: the *Receipts / attachments*
epic ([#96](https://github.com/darthjee/ward/issues/96)). A PDF export is the *PDF accountant
export* epic ([#97](https://github.com/darthjee/ward/issues/97)), deferred because of the heavy
library on the 512 MB free tier.

### Alternatives considered

- **A per-transaction flag** — rejected: ticking every charge.
- **Every provider-expense account is for the accountant** — rejected: personal providers would
  leak into the export.
- **A hand-off record table** — rejected: an owner-level record spanning accounts breaks "only
  `bank_accounts` stores the owner".
- **A server CSV route** — rejected: it may drift from the preview, breaks the `.json`
  convention and needs download headers.
- **An `isRefund` flag or `kind` column** — rejected: it reopens the `kind` decision;
  categories cover it.
- **A `Provider` entity with tagged transactions on regular accounts** — rejected: a provider
  expense is an account type, and payees / categories are their own epics.
- **An expense log without payments** — rejected: it can't answer "do I owe this provider
  anything?".

## Charges and bills

Recurring charges become derived Calendar occurrences, and one-off bills always hang off a
provider-expense account (see [bills.md](bills.md)). Paying a provider bill records a payment
plus an optional charge ("Also record the charge"); that charge feeds the hand-off like any
other. A provider exposes `expectedAmount`, `chargeFrequency`, `dueDay`, `dueMonth`,
`forAccountant`, its balance, opening date and archived state; it stores no bill rows itself.

## Deferred

- Receipts / attachments: [#96](https://github.com/darthjee/ward/issues/96)
- PDF accountant export: [#97](https://github.com/darthjee/ward/issues/97)
- Refunds via categories: [#89](https://github.com/darthjee/ward/issues/89)
- Reconciliation locks on sent charges: [#85](https://github.com/darthjee/ward/issues/85)
- Linked transfers: [#86](https://github.com/darthjee/ward/issues/86)

## Differences from the original spec

- The **mark timestamp** is truncated to whole seconds, as stored by the `DATETIME` column, so
  the reply matches what is read back later.
- The **CSV** uses CRLF line endings (the spec didn't say).
