# Bank — Bills

A **bill** is something to pay on a due date. Ward uses a **hybrid model**: a debt's bills are
derived from the debt account's own schedule, and a provider-expense account holds N stored
[provider bills](#provider-bills), each `recurring` (a schedule) or `one_off` (one due date). The
Calendar merges both. Part of the [Bank module](../bank.md); the
pages are in [ui.md](ui.md).

Endpoints: [Routes — Bank → Bills and calendar](../../backend/routes/bank.md#bills-and-calendar)
and [Provider bills](../../backend/routes/bank.md#provider-bills).

## Scope

- **Debt schedules are derived, never stored.** A debt's **occurrences** are computed per
  request from the schedule the account already carries (instalment, frequency, `dueDay`,
  `dueMonth`) plus the [schedule fields](#schedule-fields). No copy, no sync.
- **Provider schedules are stored on recurring provider bills.** A provider (one tax id, one
  ledger) may hold **several recurring bills** (an ISP's internet, phone and mobile), each with
  its own schedule; their occurrences are computed per request from each bill.
- **Every bill belongs to an account** — there is no bill without a provider (or debt) account.
  Epic [#119](https://github.com/darthjee/ward/issues/119) reversed the earlier "no standalone
  recurring bills" decision only in that a provider may now hold several recurring bills.
- **One-offs** are provider bills with `kind = one_off`, for what no schedule models (a yearly
  tax, a fine, a repair).
- Only `monthly` and `yearly` periods; other periods are decided against.
- **Auto-pay or payment execution is out of the product**: Ward records what happens, it never
  moves money.

Deferred: *Automatic bill import* (Open Finance, boleto reading;
[#103](https://github.com/darthjee/ward/issues/103)) and *Projected balance* using upcoming
bills ([#104](https://github.com/darthjee/ward/issues/104)). Card statements as bills belong to
*Credit card accounts* ([#91](https://github.com/darthjee/ward/issues/91)); categories on bills
to [#89](https://github.com/darthjee/ward/issues/89); receipts on paid bills to
[#96](https://github.com/darthjee/ward/issues/96).

## Provider bills

Entity `ProviderBill`, table `bank_provider_bills` (renamed from `bank_bills`, so one-off ids
survived). One row per charge; many rows per provider. Managed through the provider-bills routes
([Routes — Bank → Provider bills](../../backend/routes/bank.md#provider-bills)).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | int PK | no | |
| `provider_account_id` | int | no | Real FK to `bank_accounts`, `ON DELETE CASCADE`. **No owner column**: the owner is the provider account's |
| `kind` | varchar(16) | no | `recurring` or `one_off`; immutable (see [Kinds](#kinds)) |
| `description` | varchar(255) | no | Required on both kinds; trimmed |
| `paying_account_id` | int | yes | Per-bill **default paying account**: a non-archived `regular` account of the provider's owner and currency; FK, `ON DELETE SET NULL` |
| `expected_amount` | bigint | yes | Minor units of the provider's currency, `> 0` when set |
| `notes` | text | yes | At most 2000 characters; never exposed in occurrence payloads |
| `charge_frequency`, `due_day`, `due_month`, `bills_from`, `show_in_calendar` | | yes | The recurring group (see [Schedule fields](#schedule-fields)) |
| `due_date` | date | yes | The one-off group |
| `created_at`, `updated_at` | datetime | no | |

- **Description uniqueness** — unique per provider **among recurring bills only**,
  case- and accent-insensitive (`"Água"` = `"agua"`), via the **virtual** generated column
  `recurring_description = IF(kind = 'recurring', description, NULL)` and
  `UNIQUE (provider_account_id, recurring_description)`; the column is not mapped by the
  entity. Violation → `409 PROVIDER_BILL_NAME_TAKEN`. One-off descriptions may repeat, and a
  one-off may share a description with a recurring bill.
- **Cap** — at most **50 recurring bills per provider** → `409 PROVIDER_BILL_LIMIT`, counted
  and inserted in one transaction under a lock on the provider row. One-offs are uncapped; the
  list is paginated.
- **Indexes** — `(provider_account_id, kind, description)` serves the list, the calendar source
  query and the uniqueness lookup; `(provider_account_id, due_date)` serves one-offs; history by
  bill uses the `bank_bill_payments.provider_bill_id` FK index.
- **The ledger is unchanged** — a provider keeps one ledger and one balance; a charge or payment
  is a plain `Transaction` on the provider account and **nothing links a transaction to a
  bill** (the bill is a schedule, not a sub-ledger). A per-transaction link is the
  *Per-transaction bill link* epic ([#140](https://github.com/darthjee/ward/issues/140)).

Edge cases:

- **Provider archived** — its bills leave the Calendar; the list, the single `GET` and the
  per-bill history stay readable; create (`409 ACCOUNT_ARCHIVED`), `PATCH`, `DELETE` and pay /
  skip (uniform `404`) are refused. They return on unarchive.
- **Provider deleted** — bills cascade, and their payment rows cascade through the bill.
- **Currency change on the provider** (only before any transaction) — rescales every bill's
  `expected_amount` in one transaction with row locks; an amount not representable in the new
  exponent → `400` and the whole PATCH fails.
- **`show_in_calendar: false`** — no occurrence, but the bill stays editable and keeps its
  history.
- **Renaming a recurring bill** — only labels change; payment identity is `provider_bill_id`, so
  history is kept.
- **No per-bill archiving** — `ProviderBill` has no `archived` column; a bill leaves the list
  and Calendar only with its provider. To stop one bill, delete it (when it has no paid payment)
  or set `show_in_calendar: false`; the add / edit form says so. Archiving one bill is the
  *Archive an individual provider bill* epic ([#141](https://github.com/darthjee/ward/issues/141)).

### Kinds

- `recurring` bills produce derived occurrences through `occurrence-generator.ts` (one schedule
  per recurring bill).
- `one_off` bills produce exactly one occurrence, on `due_date` (no weekend shift).
- **`kind` is immutable** — a `PATCH` sending a different value → `409
  PROVIDER_BILL_KIND_LOCKED`. Converting means delete + create.
- **Provider lock** — `provider_account_id` is immutable on recurring bills → `409
  PROVIDER_BILL_PROVIDER_LOCKED`, checked **before** resolving any target provider (no probing
  through 404-vs-409). A one-off may move to another provider of the same owner unless paid
  (`409 PROVIDER_BILL_PAID`); the target must be active (`409 ACCOUNT_ARCHIVED`) and of the same
  currency (`422 CURRENCY_MISMATCH`). Its skipped payment row follows it.
- **Delete** — `409 PROVIDER_BILL_PAID` when any payment row is `paid`; otherwise the bill goes
  with its skipped rows.

Validation runs on the **merged state** (stored row plus the patch); `null` clears a field and
an absent field leaves it unchanged. A violation, or a field of the other group, → `400`, never
silently ignored:

| Column | `recurring` | `one_off` |
|---|---|---|
| `description` | required | required |
| `expected_amount` | optional (`> 0` when set) | **required** (`> 0`) |
| `paying_account_id` | optional | optional |
| `notes` | optional | optional |
| `charge_frequency` | required, default `monthly` | must be `null` |
| `due_day` | required (1–31) | must be `null` |
| `due_month` | required only when `yearly`, otherwise `null` | must be `null` |
| `bills_from` | required, default UTC today | must be `null` |
| `show_in_calendar` | required, default `true` | must be `null` |
| `due_date` | must be `null` | required |

A recurring bill without `expected_amount` still shows in the Calendar; its Pay dialog then
requires an explicit amount.

## Schedule fields

A schedule lives in two places:

- **Recurring provider bills** — `expected_amount`, `charge_frequency`, `due_day`,
  `due_month`, `bills_from`, `show_in_calendar` and the per-bill `paying_account_id` (see
  [Provider bills](#provider-bills)). The provider itself carries no schedule (its seven
  schedule columns were dropped by [#125](https://github.com/darthjee/ward/issues/125)), and
  there is no provider-level default paying account: one default could not serve bills with
  different paying accounts.
- **Debt accounts** — the instalment, frequency, `dueDay` and `dueMonth` on the debt, plus three
  fields on `bank_debt_details` (migration `20261108120022-bank-add-schedule-fields.ts`):

| Field | Type | Notes |
|---|---|---|
| `billsFrom` | `DATE`, nullable | Start of the schedule: the first occurrence is the first due date **on or after** it. Editable |
| `showInCalendar` | boolean, not null, default `true` | `false` → the account never produces occurrences |
| `payingAccountId` | nullable, FK → `bank_accounts`, `ON DELETE SET NULL` | **Default paying account**: a `regular`, non-archived account of the same owner and currency; pre-fills the Pay dialog |

- In the API they travel in the `debt` object: the request takes
  `bills_from`, `show_in_calendar` and `paying_account_id`; the response returns `bills_from`,
  `show_in_calendar` and `paying_account: { id, name } | null` (never the raw id).
- Setting `dueDay` for the first time while `billsFrom` is `null` and not sent sets `billsFrom`
  to UTC today. Clearing `dueDay` **keeps** `billsFrom`, so re-enabling the schedule does not
  resurrect old occurrences as overdue.
- A bad `paying_account_id` → 422 (see [Validation](#validation)). A currency-changing account
  PATCH re-checks a stored default (422 `CURRENCY_MISMATCH` when it no longer matches).
- The migration backfilled `bills_from` = the migration date for accounts that already had a
  `due_day`, so existing schedules appeared without a phantom overdue backlog. Payments of
  providers that had no schedule were backfilled onto **hidden** recurring bills
  (`show_in_calendar = false`) until a schedule is set.

## One-off bills

The `one_off` kind. Besides the provider-bills routes, the older `bills.json` routes remain a
**compatibility projection** that only sees one-offs (a recurring bill id answers 404, a
recurring field in the body → 400) and keeps the API field `amount`, mapped to
`expected_amount`:

| Field | Required | Notes |
|---|---|---|
| `providerAccountId` | yes | A `provider_expense` account of the active owner; FK, `ON DELETE CASCADE` |
| `payingAccountId` | yes on create (`bills.json`) | A `regular`, non-archived account of the same owner and the provider's currency; FK, `ON DELETE SET NULL` (then the Pay dialog requires a choice) |
| `dueDate` | yes | `DATE`, any date (an already overdue bill can be entered); **no weekend shift** |
| `amount` | yes | `BIGINT` minor units, > 0, in the provider's currency, within the amount bound |
| `description` | yes | Trimmed, at most 255 characters |
| `notes` | no | At most 2000 characters |

- Changing the provider re-checks the paying account's currency (422) and rescales the stored
  amount into the new currency's exponent (400 when it can't be represented).
- **Editing a bill with a payment row** — changing the provider of a `paid` bill → 409
  `BILL_PAID` on `bills.json` (`PROVIDER_BILL_PAID` on the provider-bills route; undo first).
  Otherwise the payment row follows the bill (source account and due date) in the same DB
  transaction.
- **Deleting** a `paid` bill → 409 `BILL_PAID` (`PROVIDER_BILL_PAID`). An unpaid or skipped bill
  is deleted with its payment row.
- On `bills.json`, a bill whose provider is **archived** is hidden: it leaves the list, and
  `GET`, `PATCH` and `DELETE` on it answer 404 (the provider-bills `GET` still reads it). It
  comes back on unarchive. An archived provider in a bill body → 422 `ACCOUNT_NOT_FOUND`.

## Recurrence

Applies to occurrences derived from debt accounts and recurring provider bills (pure helper
`occurrence-generator.ts`). Each recurring bill is its own series: a provider with three
recurring bills produces three series.

- **A schedule exists** when `dueDay` **and** `billsFrom` are set, `showInCalendar` is `true`
  and the account (for a bill, its provider) is not archived.
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
| `kind` | `OccurrenceKind`: `debt`, `provider_bill` (derived from a recurring provider bill) or `bill` (one-off) |
| `source_account` | `{ id, name, type }`: the debt / provider (for a one-off, its provider) |
| `source_bill` | `{ id, description }` of the provider bill (recurring or one-off), `null` for debts; never `notes` |
| `bill` | `{ id, description }` for one-offs, `null` otherwise |
| `nominal_date` / `effective_date` | See [Recurrence](#recurrence) |
| `expected_amount` | Decimal string, or `null` when the bill / account has none (the Pay dialog then requires an amount) |
| `currency` | The source account's currency |
| `status` | `open`, `overdue`, `paid` or `skipped` |
| `payment` | `{ id, status, paid_on, amount, paying_account }` for paid / skipped, else `null` |
| `default_paying_account` | `{ id, name }` or `null` |

Sort: `effective_date`, then `kind`, then the **bill id before the source account id**, so two
bills of one provider on the same day order deterministically. The 366-day range and the
1000-occurrence caps count **total** occurrences across all bills, and `overdue.json` is bounded
the same way, listing each recurring bill's unpaid occurrences independently.

Accounts are exposed by id and name only. Totals are one entry per currency, never summed; the
exact envelopes are in the [routes page](../../backend/routes/bank.md#calendar-envelope-and-totals).

## Paying, skipping and undoing

One `bank_bill_payments` row per occurrence:

| Column | Notes |
|---|---|
| `sourceAccountId` | The debt / provider (for a bill, its provider); FK, `ON DELETE CASCADE` |
| `providerBillId` | Set for recurring provider bills; indexed FK to `bank_provider_bills`, `ON DELETE CASCADE` |
| `billId` | Set for one-offs; FK to `bank_provider_bills`, `ON DELETE CASCADE` |
| `dueDate` | The **nominal** due date |
| `status` | `paid` \| `skipped` |
| `paidOn` | `paid` only; at most UTC today + 1 day |
| `amount` | `paid` only; > 0 |
| `payingAccountId` | `paid` only; FK, `ON DELETE SET NULL` |
| `paymentTransactionId`, `withdrawalTransactionId`, `chargeTransactionId` | The transactions the payment created; FKs, `ON DELETE SET NULL` |

- Paying twice → 409 `OCCURRENCE_ALREADY_PAID`; two different bills of one provider paid on
  the same date both succeed (see [Payment keys](#payment-keys)).
- No owner columns: the row inherits the owner from its source account.

### Payment keys

Every payment row falls under exactly one unique key:

| Payments of | Identity | Key |
|---|---|---|
| Debt occurrences | `(source_account_id, due_date)` | `UNIQUE (source_account_id, derived_due_date)`, `derived_due_date = IF(bill_id IS NULL AND provider_bill_id IS NULL, due_date, NULL)` |
| Recurring provider bills | `(provider_bill_id, due_date)` | `UNIQUE (provider_bill_id, provider_bill_due_date)`, `provider_bill_due_date = IF(provider_bill_id IS NOT NULL, due_date, NULL)` |
| One-off bills | `(bill_id)` | `UNIQUE (bill_id)` |

- The debt key is **narrowed** to rows with neither bill id; otherwise it would also cover
  recurring provider-bill payments (which keep `bill_id NULL`) and reject two bills of one
  provider paid on the same date.
- **Pitfall** — both generated columns must stay **VIRTUAL** and **unmapped** by the entity
  (TypeORM never writes them): MySQL refuses a STORED generated column over a cascading FK.
  `due_date` remains the real, mapped column.
- The payment writer locks the `ProviderBill` row `FOR UPDATE` and re-checks the payment in the
  same transaction (the unique keys stay the final guard), so the lock is per bill.
- The calendar's payment-map key is `${providerBillId}:${nominal}` for provider bills and
  `${sourceAccountId}:${nominal}` for debts.

**Paid** — the row and its ledger transactions are written in **one DB transaction**; if any
part fails, nothing is saved:

- **debt** — a payment (+) on the debt and a withdrawal (−) on the paying account;
- **provider bill** (recurring or one-off, paid per bill) — a payment (+) on the provider and a withdrawal (−) on the
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

- **Path ids** (`:accountId`, `:id`) — the uniform 404, never 403. On the account-level
  occurrence payment and `bill-payments.json` routes, a path account that is not a debt → 404
  (providers use the per-bill routes since #125, and get the same uniform 404 here). A `:dueDate` that is not an occurrence (off-schedule, before
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

`accounts/:accountId/bill-payments.json` lists the payment rows of a debt account, and
`provider-bills/:id/bill-payments.json` those of **one** provider bill, newest due date first,
paginated. Each row says whether it is **off-schedule**: its due date is not a nominal
occurrence of the **current** schedule pattern of that debt or that bill (`due_day`,
`due_month`, frequency, `bills_from`; archived and `show_in_calendar` are ignored, and with no
`due_day` every derived row is off-schedule). Editing one bill never marks another bill's
payments off-schedule.

**Schedule edits after payments** are always allowed. Payments that no longer match are kept,
never deleted: they show as off-schedule in the history, not on the Calendar, and come back if
the schedule changes back. An archived account's (or provider's) history stays readable.

## Data sensitivity and ownership

On top of the [ownership contract](../bank.md#bank-ownership-contract):

1. Provider bills are **personal financial data**. A `ProviderBill` inherits its owner from its
   provider account; a payment row from its source account. No row stores an owner copy, and
   an owner / organization id is never taken from a request body.
2. **Same owner only** — the paying account must belong to the source account's owner. Paying
   an organization's bill from a personal account stays two manual transactions.
3. **The Calendar is per context** — Personal shows personal bills only, an organization only
   its own. One view across owners is the *Combined calendar across owners* epic
   ([#101](https://github.com/darthjee/ward/issues/101)).
4. **Personal context**: owner only; the global admin gets **no** access. **Organization
   context**: every member sees, edits and pays every bill of it (roles not enforced until
   [#81](https://github.com/darthjee/ward/issues/81)). A non-member, including a global admin
   who is not a member, gets the uniform `404`.
5. Every `409` comes only **after** the owner-scoped resolve, so no code leaks the existence of a
   foreign record; the uniform `404` also covers a non-numeric id and a malformed `:dueDate`.
6. Responses carry no owner fields; accounts by id and name only.
7. Descriptions and notes are financial data; bodies are never logged.

## Owning module

- **`bank`** (lazy tier): bills load with the rest of the lazy module; no new module, no idle
  cost, no new dependency (the date maths is a small pure helper).
- **Paying a bill is an in-module service call** in one DB transaction: **no event** is emitted
  or consumed.
- **Performance** — occurrences are computed in memory per request with a few batched queries:
  the owner's scheduled debts, the recurring bills of the owner's non-archived providers in
  **one** query (`provider_account_id IN (…) AND kind = 'recurring'`, no N+1), the payments in
  the range and the one-off bills in the range. The
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
2. **Archived provider** — all its bills leave the Calendar, and come back on unarchive.
3. **Linked transaction edited or deleted by hand** — the payment row stays; undo removes only
   the transactions that still exist.
4. **Deleted paying account** — `ON DELETE SET NULL` on the default and on payment rows; the
   payment stays recorded.
5. **Deleted source account or bill** — its payment rows go with it (`ON DELETE CASCADE`). The
   account delete rule still applies (409 while it has transactions).

## Deferred

- Linked transfers (paying as one linked operation): [#86](https://github.com/darthjee/ward/issues/86)
- Per-transaction bill link: [#140](https://github.com/darthjee/ward/issues/140)
- Archive an individual provider bill: [#141](https://github.com/darthjee/ward/issues/141)
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
- **Provider bills** ([#119](https://github.com/darthjee/ward/issues/119)) — the provider-bills
  `GET` reads a bill of an archived provider (one place of the split-provider spec said `404`);
  `PATCH` / `DELETE` still answer `404`. `source_bill` is also set on one-off (`bill`)
  occurrences, not only recurring ones.
- The other details decided in #56 (the virtual generated column, undo codes, envelopes,
  totals, pagination, description truncation, the `paid_on` limit) are recorded above.
