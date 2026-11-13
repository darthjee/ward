# Bank — Bills

A **bill** is something to pay on a due date. Ward uses a **hybrid model**: recurring bills are
derived from debt and provider-expense accounts, and the few bills no account models are stored
as one-off `Bill` rows. The Calendar merges both. Part of the [Bank module](../bank.md); the
pages are in [ui.md](ui.md).

Endpoints: [Routes — Bank → Bills and calendar](../../backend/routes/bank.md#bills-and-calendar).

## Scope

- **Recurring bills are derived, never stored.** Debt and provider-expense accounts are the
  **only** recurring sources. Their **occurrences** are computed per request from the schedule
  the account already carries (instalment / expected amount, frequency, `dueDay`, `dueMonth`)
  plus the [schedule fields](#schedule-fields). The schedule lives only on the account: no
  copy, no sync.
- **No standalone recurring bills** — a recurring payment always means a provider-expense (or
  debt) account. Decided against, not deferred.
- **One-off bills** are a small `Bill` entity for what no account models (a yearly tax, a fine,
  a repair). Each one references a provider-expense account, which gives it its owner.
- Only `monthly` and `yearly` periods; other periods are decided against.
- **Auto-pay or payment execution is out of the product**: Ward records what happens, it never
  moves money.

Deferred: *Automatic bill import* (Open Finance, boleto reading;
[#103](https://github.com/darthjee/ward/issues/103)) and *Projected balance* using upcoming
bills ([#104](https://github.com/darthjee/ward/issues/104)). Card statements as bills belong to
*Credit card accounts* ([#91](https://github.com/darthjee/ward/issues/91)); categories on bills
to [#89](https://github.com/darthjee/ward/issues/89); receipts on paid bills to
[#96](https://github.com/darthjee/ward/issues/96).

## Schedule fields

Three fields on `bank_debt_details` and `bank_provider_expense_details` (migration
`20261108120022-bank-add-schedule-fields.ts`):

| Field | Type | Notes |
|---|---|---|
| `billsFrom` | `DATE`, nullable | Start of the schedule: the first occurrence is the first due date **on or after** it. Editable |
| `showInCalendar` | boolean, not null, default `true` | `false` → the account never produces occurrences |
| `payingAccountId` | nullable, FK → `bank_accounts`, `ON DELETE SET NULL` | **Default paying account**: a `regular`, non-archived account of the same owner and currency; pre-fills the Pay dialog |

- In the API they travel in the `debt` / `provider_expense` object: the request takes
  `bills_from`, `show_in_calendar` and `paying_account_id`; the response returns `bills_from`,
  `show_in_calendar` and `paying_account: { id, name } | null` (never the raw id).
- Setting `dueDay` for the first time while `billsFrom` is `null` and not sent sets `billsFrom`
  to UTC today. Clearing `dueDay` **keeps** `billsFrom`, so re-enabling the schedule does not
  resurrect old occurrences as overdue.
- A bad `paying_account_id` → 422 (see [Validation](#validation)). A currency-changing account
  PATCH re-checks a stored default (422 `CURRENCY_MISMATCH` when it no longer matches).
- The migration backfilled `bills_from` = the migration date for accounts that already had a
  `due_day`, so existing schedules appeared without a phantom overdue backlog.

## One-off bills

`Bill` (`bank_bills`):

| Field | Required | Notes |
|---|---|---|
| `providerAccountId` | yes | A `provider_expense` account of the active owner; FK, `ON DELETE CASCADE` |
| `payingAccountId` | yes on create | A `regular`, non-archived account of the same owner and the provider's currency; FK, `ON DELETE SET NULL` (then the Pay dialog requires a choice) |
| `dueDate` | yes | `DATE`, any date (an already overdue bill can be entered); **no weekend shift** |
| `amount` | yes | `BIGINT` minor units, > 0, in the provider's currency, within the amount bound |
| `description` | yes | Trimmed, at most 255 characters |
| `notes` | no | At most 2000 characters |

- No owner columns: the owner is the provider account's owner.
- Changing the provider re-checks the paying account's currency (422) and rescales the stored
  amount into the new currency's exponent (400 when it can't be represented).
- **Editing a bill with a payment row** — changing the provider of a `paid` bill → 409
  `BILL_PAID` (undo first). Otherwise the payment row follows the bill (source account and due
  date) in the same DB transaction.
- **Deleting** a `paid` bill → 409 `BILL_PAID`. An unpaid or skipped bill is deleted with its
  payment row.
- A bill whose provider is **archived** is hidden: it leaves the list and the Calendar, and
  `GET`, `PATCH` and `DELETE` on it answer 404. It comes back on unarchive. An archived
  provider in a bill body → 422 `ACCOUNT_NOT_FOUND`.
- Index `bank_bills (provider_account_id, due_date)`.

## Recurrence

Applies to occurrences derived from debt and provider-expense accounts (pure helper
`occurrence-generator.ts`):

- **A schedule exists** when `dueDay` **and** `billsFrom` are set, `showInCalendar` is `true`
  and the account is not archived.
- **Start** — the first occurrence is the first due date on or after `billsFrom`. The opening
  date is not used, so an old loan produces no backlog of phantom overdue instalments.
- **End** — open-ended. `instalmentCount` and a zero balance are not stop conditions; only
  archiving or `showInCalendar` `false` stop it.
- **Clamp** — `dueDay` 29–31 → the month's last day (31 → 30 Apr; 29–31 → 28 Feb, or 29 Feb in
  leap years); yearly 29 Feb → 28 Feb in non-leap years. Exactly one occurrence per period.
- **Weekends** — an occurrence on Saturday or Sunday has an **effective** date on the next
  Monday. No holidays, no per-account rule: the *Business-day calendar for bills* epic
  ([#100](https://github.com/darthjee/ward/issues/100)).
- **Nominal vs effective** — the **nominal** date is after the clamp, before the shift.
  Payments are keyed by the nominal date; the effective date is only for display and the
  overdue check, so changing the shift rule never orphans a payment. One-off bills: both are
  `dueDate`.
- **Archived accounts** produce no occurrences, past or future; their payments stay stored and
  reappear on unarchive.
- **Overdue** — open (neither paid nor skipped) with an effective date before UTC today.

## Occurrence shape

The Calendar routes return derived occurrences and one-off bills in one `snake_case` shape:

| Field | Notes |
|---|---|
| `kind` | `debt`, `provider` (derived) or `bill` (one-off) |
| `source_account` | `{ id, name, type }`: the debt / provider (for a one-off, its provider) |
| `bill` | `{ id, description }` for one-offs, `null` otherwise |
| `nominal_date` / `effective_date` | See [Recurrence](#recurrence) |
| `expected_amount` | Decimal string, or `null` when the account has none (the Pay dialog then requires an amount) |
| `currency` | The source account's currency |
| `status` | `open`, `overdue`, `paid` or `skipped` |
| `payment` | `{ id, status, paid_on, amount, paying_account }` for paid / skipped, else `null` |
| `default_paying_account` | `{ id, name }` or `null` |

Accounts are exposed by id and name only. Totals are one entry per currency, never summed; the
exact envelopes are in the [routes page](../../backend/routes/bank.md#calendar-envelope-and-totals).

## Paying, skipping and undoing

One `bank_bill_payments` row per occurrence:

| Column | Notes |
|---|---|
| `sourceAccountId` | The debt / provider (for a one-off, its provider); FK, `ON DELETE CASCADE` |
| `billId` | Set for one-offs; FK to `bank_bills`, `ON DELETE CASCADE` |
| `dueDate` | The **nominal** due date |
| `status` | `paid` \| `skipped` |
| `paidOn` | `paid` only; at most UTC today + 1 day |
| `amount` | `paid` only; > 0 |
| `payingAccountId` | `paid` only; FK, `ON DELETE SET NULL` |
| `paymentTransactionId`, `withdrawalTransactionId`, `chargeTransactionId` | The transactions the payment created; FKs, `ON DELETE SET NULL` |

- **Uniqueness** — one row per derived occurrence, `UNIQUE (source_account_id,
  derived_due_date)` on an indexed **virtual** generated column (`due_date` when `bill_id` is
  null; MySQL refuses a stored generated column over a cascading FK); one row per one-off,
  `UNIQUE (bill_id)`. Paying twice → 409 `OCCURRENCE_ALREADY_PAID`.
- No owner columns: the row inherits the owner from its source account.

**Paid** — the row and its ledger transactions are written in **one DB transaction**; if any
part fails, nothing is saved:

- **debt** — a payment (+) on the debt and a withdrawal (−) on the paying account;
- **provider** (derived or one-off) — a payment (+) on the provider and a withdrawal (−) on the
  paying account, plus, with **"Also record the charge"** (`record_charge`, default `true`), an
  unsent charge (−) on the provider that feeds the [accountant
  hand-off](provider-expense.md#accountant-hand-off).

They are ordinary transactions, dated `paidOn`, described
`"<bill description | account name> — <nominal date>"` (only the label is truncated, by code
points, so the text stays within 255 and the date suffix is kept), and editable later. The paid
amount may differ from the expected one. **No partial payments**: one payment closes the
occurrence.

**Skipped** — writes only the row, with no amount and no transactions. A skipped occurrence is
neither open nor overdue.

**Undo** — `204`; deletes the row and the transactions it created **that still exist** (a charge
already sent to the accountant included), in one DB transaction, so the occurrence is open or
overdue again.

- No payment → 404.
- A `paid` payment whose source or paying account is archived → 409 `ACCOUNT_ARCHIVED` (unarchive
  first). A skip on an archived source, or a one-off of an archived provider → 404 (the
  occurrence is hidden).
- Undo finds the row with **no schedule check**, so off-schedule payments can still be undone;
  paying keeps the strict 404.

**Check order** on pay / skip: path 404, then body 400, then the paying-account 422, then the
409.

Paying a bill as one linked operation is part of the *Linked transfers* epic
([#86](https://github.com/darthjee/ward/issues/86)).

## Validation

- **Path ids** (`:accountId`, `:id`) — the uniform 404, never 403. A path account that is not a
  debt / provider → 404. A `:dueDate` that is not an occurrence (off-schedule, before
  `billsFrom`, hidden or archived account) → 404.
- **Body account ids** (`provider_account_id`, `paying_account_id`) that are unknown, another
  owner's, in the other context, of the wrong type or an archived paying account (or archived
  provider) → **422 `ACCOUNT_NOT_FOUND`**, one generic body that never says which reason
  applied.
- **Currency** — a visible same-owner account with another currency → **422
  `CURRENCY_MISMATCH`**. This allows no probing: the account is already visible.
- **Payment body** — `status`; for `paid` also `paid_on`, `amount`, `paying_account_id` and
  `record_charge` (providers and one-offs only). Extra fields on a skip, or `record_charge` on a
  debt → 400.
- **Calendar range** — `from` / `to` required, `from` ≤ `to`, `to − from` ≤ 366 days, no
  repeated parameter; otherwise 400.

## Bill history

`bill-payments.json` lists the payment rows of a debt / provider account, newest due date first,
paginated. Each row says whether it is **off-schedule**: its due date is not a nominal
occurrence of the account's **current** schedule pattern (`due_day`, `due_month`, frequency,
`bills_from`; archived and `show_in_calendar` are ignored, and with no `due_day` every derived
row is off-schedule).

**Schedule edits after payments** are always allowed. Payments that no longer match are kept,
never deleted: they show as off-schedule in the history, not on the Calendar, and come back if
the schedule changes back. An archived account's history stays readable.

## Data sensitivity and ownership

On top of the [ownership contract](../bank.md#bank-ownership-contract):

1. A one-off `Bill` inherits its owner from its provider account; a payment row from its source
   account. No row stores an owner copy.
2. **Same owner only** — the paying account must belong to the source account's owner. Paying
   an organization's bill from a personal account stays two manual transactions.
3. **The Calendar is per context** — Personal shows personal bills only, an organization only
   its own. One view across owners is the *Combined calendar across owners* epic
   ([#101](https://github.com/darthjee/ward/issues/101)).
4. Every member of an organization sees and pays every bill of it (roles not enforced; see
   [#81](https://github.com/darthjee/ward/issues/81)).
5. Responses carry no owner fields; accounts by id and name only.
6. Descriptions and notes are financial data; bodies are never logged.

## Owning module

- **`bank`** (lazy tier): bills load with the rest of the lazy module; no new module, no idle
  cost, no new dependency (the date maths is a small pure helper).
- **Paying a bill is an in-module service call** in one DB transaction: **no event** is emitted
  or consumed.
- **Performance** — occurrences are computed in memory per request with three queries (the
  owner's scheduled accounts, the payments in the range, the one-off bills in the range). The
  366-day cap bounds the work. Overdue goes back to `billsFrom` and only grows with occurrences
  left open, which is fine at personal scale. Index `bank_bill_payments (source_account_id,
  due_date)`.
- A future **cross-module calendar** must read bank occurrences through an exported service or
  DI token, **never events** (lazy listeners can miss events, see
  [Modular Pattern](../../architecture/modular-pattern.md)): the *Cross-module calendar* epic
  ([#98](https://github.com/darthjee/ward/issues/98)). Reminders before a due date are the
  *Bill reminders / notifications* epic ([#99](https://github.com/darthjee/ward/issues/99)).

## Edge cases

1. **Archived paying account** — can't be chosen for a new payment (422); if it is the stored
   default, the Pay dialog requires another choice. Existing payments are unaffected.
2. **Archived provider** — its one-off bills disappear with its derived occurrences, and come
   back on unarchive.
3. **Linked transaction edited or deleted by hand** — the payment row stays; undo removes only
   the transactions that still exist.
4. **Deleted paying account** — `ON DELETE SET NULL` on the default and on payment rows; the
   payment stays recorded.
5. **Deleted source account or bill** — its payment rows go with it (`ON DELETE CASCADE`). The
   account delete rule still applies (409 while it has transactions).

## Deferred

- Linked transfers (paying as one linked operation): [#86](https://github.com/darthjee/ward/issues/86)
- Currency conversion (Calendar totals across currencies): [#88](https://github.com/darthjee/ward/issues/88)
- Cross-module calendar: [#98](https://github.com/darthjee/ward/issues/98)
- Bill reminders / notifications: [#99](https://github.com/darthjee/ward/issues/99)
- Business-day calendar for bills: [#100](https://github.com/darthjee/ward/issues/100)
- Combined calendar across owners: [#101](https://github.com/darthjee/ward/issues/101)
- Calendar feed (iCal / `.ics`): [#102](https://github.com/darthjee/ward/issues/102)
- Automatic bill import: [#103](https://github.com/darthjee/ward/issues/103)
- Projected balance: [#104](https://github.com/darthjee/ward/issues/104)

## Differences from the original spec

- **`paying_account`** — schedule fields and bills return `paying_account: { id, name } | null`;
  requests take `paying_account_id`.
- **Archived provider** — `GET`, `PATCH` and `DELETE /bills/:id.json` answer 404 for a bill
  whose provider is archived (the spec only said such bills leave the Calendar).
- **A schedule needs `bills_from`** — a `null` `bills_from` with `due_day` set means no
  schedule ([#56](https://github.com/darthjee/ward/issues/56)).
- The other details decided in #56 (the virtual generated column, undo codes, envelopes,
  totals, pagination, description truncation, the `paid_on` limit) are recorded above.
