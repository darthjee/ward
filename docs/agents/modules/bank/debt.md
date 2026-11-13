# Bank — Debt accounts

A debt account models a **loan**: an `Account` with `type` `debt`. It reuses the common fields,
name rule and archive vs delete of [accounts.md](accounts.md) and the ledger of
[transactions.md](transactions.md), and adds only the debt fields below. Part of the
[Bank module](../bank.md).

Endpoints: [Routes — Bank → Debt object](../../backend/routes/bank.md#debt-object).

## Ledger and sign rules

- **Opening anchor** = the amount borrowed, as a **negative** balance on the loan date (for
  example `-10000.00`). It is not forced negative: zero or positive is allowed (recording starts
  after a partial payoff, or a correction).
- **Payments** are positive transactions. **Interest** is entered by hand as a negative
  transaction when charged; nothing accrues automatically.
- **Paid off** is simply a balance of `0`: no badge, no archive suggestion, no automatic action.
- **Overpayment is allowed** — the balance may go positive, with no block and no warning.
- No principal / interest split: an instalment of "500 = 120 interest + 380 principal" is an
  interest transaction `-120` plus a payment `+500`.
- No interest automation: the rate is informational (no accrual, no Price / SAC amortization, no
  projected payoff).

## Fields

The common fields apply. `bankName` is reused as the **creditor**, and the opening anchor holds
the original amount and the loan date (no separate `principal` or `startDate`).

Debt fields, all optional, in `bank_debt_details` (1:1, `account_id` PK and FK, `ON DELETE
CASCADE`, no owner columns):

| Field | Type | Notes |
|---|---|---|
| `interestRate` | decimal, 0–100, at most 4 decimals | Informational; returned without trailing zeros (`"1.99"`, `"0"`) |
| `interestPeriod` | `monthly` \| `yearly` | Required with `interestRate`, and only then |
| `instalmentAmount` | `BIGINT` minor units, > 0 | Expected payment; within the amount bound; the bill's expected amount |
| `instalmentFrequency` | `monthly` \| `yearly` | Default `monthly` |
| `dueDay` | int 1–31 | Day an instalment is due; 29–31 clamp to the month's end (see [bills.md](bills.md#recurrence)) |
| `dueMonth` | int 1–12 | Required when `yearly`, rejected when `monthly` |
| `instalmentCount` | int 1–2147483647 | Informational; empty = open-ended |

Plus the bill [schedule fields](bills.md#schedule-fields) (`billsFrom`, `showInCalendar`,
`payingAccountId`).

### Rules

- A debt account always has a details row: a create without a `debt` object writes one with
  every field `null` and `instalment_frequency` `monthly`.
- PATCH merges the `debt` object partially; `null` clears a field. The paired rules
  (`interest_rate` ↔ `interest_period`, `yearly` ↔ `due_month`) are checked on the **stored
  details with the request merged on top**, not on the body alone
  ([#50](https://github.com/darthjee/ward/issues/50)). The rate is cleared by sending both
  `null`. `yearly` → `monthly` clears `due_month`.
- A currency change (only before any transaction) rescales the stored `instalment_amount`,
  keeping its decimal value (400 when it can't be represented).
- On an archived debt, any `debt` field → 409 `ACCOUNT_ARCHIVED`, but a field failing the basic
  format checks is still a 400 first.
- No cross-field checks (an instalment larger than the amount owed is allowed). An interest rate
  of 0 is valid and still needs a period.

## Recording payments

Debts use the generic transaction routes; there is no debt-specific transaction entity, route or
`kind` column. The **Add payment** and **Add interest** shortcuts on the debt detail page only
pre-fill the inline form (see [ui.md](ui.md#debts)).

Paying a debt from a regular account is two independent manual transactions, or a bill payment
(see below). Linking them is the *Linked transfers* epic
([#86](https://github.com/darthjee/ward/issues/86)).

## Instalments and bills

Instalments become derived Calendar occurrences (see [bills.md](bills.md)). A debt exposes
`instalmentAmount`, `instalmentFrequency`, `dueDay`, `dueMonth` and `instalmentCount`, plus its
balance, opening date and archived state. No bill rows and no schedule copy are stored by
debts. The balance reaching zero is **not** a stop condition, and neither is
`instalmentCount`.

## Credit cards

Credit cards share the ledger mechanics (purchases negative, payments positive, positive
balances allowed), but they are revolving, start at zero and have statement cycles. They are a
separate future `type` (for example `credit_card`), not a `debt`: the *Credit card accounts*
epic ([#91](https://github.com/darthjee/ward/issues/91)), which also covers card statements as
bills.

## Deferred

- Credit card accounts: [#91](https://github.com/darthjee/ward/issues/91)
- Linked transfers: [#86](https://github.com/darthjee/ward/issues/86)
- Transaction categories (payment / interest / fee): [#89](https://github.com/darthjee/ward/issues/89)
- Currency conversion: [#88](https://github.com/darthjee/ward/issues/88)

## Differences from the original spec

- The schedule fields come back as `paying_account: { id, name } | null`; the request takes
  `paying_account_id` (see [bills.md](bills.md#differences-from-the-original-spec)).
- The paired rules on PATCH and the currency rescale were decided during implementation (#50)
  and are recorded above.
