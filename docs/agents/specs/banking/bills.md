# Bills

> **Owned by [#33](https://github.com/darthjee/ward/issues/33).** Builds on the account specs
> realigned by [#41](https://github.com/darthjee/ward/issues/41) and finished by
> [#29](https://github.com/darthjee/ward/issues/29) ([regular.md](accounts/regular.md),
> [transactions.md](accounts/transactions.md)), [#30](https://github.com/darthjee/ward/issues/30)
> ([debt.md](accounts/debt.md)) and [#32](https://github.com/darthjee/ward/issues/32)
> ([provider-expense.md](accounts/provider-expense.md)). The Calendar submenu that shows bills is
> specified in [ui/calendar.md](ui/calendar.md).

## Summary

- A **bill** is something to pay on a due date. Ward uses a **hybrid model**:
  - **Recurring bills are derived, never stored.** Debt and provider-expense accounts are the
    **only** recurring bill sources. Their **occurrences** are computed at render time from the
    schedule the accounts already carry (`instalmentAmount` / `expectedAmount`, frequency,
    `dueDay`, `dueMonth`) plus the [schedule fields](#schedule-fields-on-source-accounts) defined
    here. The schedule lives only on the account: no copy, no sync.
  - **No standalone recurring bills.** A recurring payment always means creating a
    provider-expense (or debt) account.
  - **One-off bills** are a small `Bill` entity (`bank_bills`), used only for what no account
    models (a yearly tax, a fine, a repair). Every one-off bill **always references a
    provider-expense account**, which gives it its owner.
- The Calendar merges derived occurrences and one-off bills into **one occurrence shape** (see
  [Occurrence shape](#occurrence-shape)).
- **Paying** (or skipping) an occurrence writes one `bank_bill_payments` row, keyed by the
  occurrence's **nominal** due date, and — for `paid` — the matching ledger transactions, all in
  **one DB transaction** (see [Paying a bill](#paying-a-bill)).
- Every bill belongs to exactly one owner, the user (Personal) or an organization, through its
  account (see the [Bank ownership contract](README.md#bank-ownership-contract)).

## Scope

**In scope:** derived occurrences from debt / provider-expense accounts; the one-off `Bill`
entity; the `billsFrom`, `showInCalendar` and default `payingAccountId` schedule fields; the
recurrence rules; paying, skipping and undoing occurrences; bill and calendar routes,
permissions and cache class. The Calendar pages are in [ui/calendar.md](ui/calendar.md).

**Out of scope — existing [Future epics](README.md#future-epics)** (each now notes that it
includes bills):

| Concern | Future epic |
|---|---|
| Credit card statements as bills | *Credit card accounts* |
| Categories on bills | *Categories* |
| Receipts on paid bills | *Receipts / attachments* |
| Paying a bill as one linked operation | *Linked transfers* |
| Totals across currencies | *Currency conversion* |
| Who may create / pay / delete bills | *Organization permission system* |

**Out of scope — new [Future epics](README.md#future-epics)** added by this spec: *Cross-module
calendar*, *Bill reminders / notifications*, *Business-day calendar for bills*, *Combined calendar
across owners*, *Calendar feed (iCal / `.ics`)*, *Automatic bill import*, *Projected balance*.

**Explicitly out of the product (not an epic):** **auto-pay / payment execution**. Ward records
what happens; it never moves money.

**Decided against (not deferred):**

- Standalone recurring bills — a recurring payment always means a provider-expense account.
- Periods other than `monthly` / `yearly`.

## Schedule fields on source accounts

Three fields are added to the schedule of debt and provider-expense accounts. They are stored in
the 1:1 details tables **`bank_debt_details`** and **`bank_provider_expense_details`** (not in
the common account fields). This file is their single source of truth; the account specs only
point here.

| Field | Type | Notes |
|---|---|---|
| `billsFrom` | `DATE`, nullable | Start of the schedule: the first occurrence is the first due date **on or after** it. Set to today when `dueDay` is first set; kept when `dueDay` is cleared (see [Recurrence model](#recurrence-model)). Editable |
| `showInCalendar` | boolean, `NOT NULL DEFAULT true` | When `false`, the account never produces occurrences, even with `dueDay` set |
| `payingAccountId` | nullable | **Default paying account**: a `regular`, non-archived account of the **same owner** and the **same currency**. Pre-fills the Pay dialog and can be changed on each payment. Real FK to `bank_accounts.id`, `ON DELETE SET NULL` |

- **API** — the `debt` / `provider_expense` objects on the generic account routes (see
  [debt.md](accounts/debt.md#routes-and-permissions) and
  [provider-expense.md](accounts/provider-expense.md#routes-and-permissions)) gain
  `bills_from`, `show_in_calendar` and `paying_account_id`. The change is additive; the body
  whitelists accept them as optional. `paying_account_id` is returned with the paying account's
  `name` (`paying_account: { id, name }`), never owner fields.
- **UI** — the Debts / Providers create / edit pages gain a "Bills from" date, a "Show in
  Calendar" checkbox and a "Default paying account" select (see
  [ui/calendar.md](ui/calendar.md#changes-to-the-debts--providers-pages)).
- **Validation**:
  - `bills_from` is a valid date (past or future), or `null`;
  - `show_in_calendar` is a boolean;
  - `paying_account_id` follows the [body reference rule](#validation): unknown, another
    owner's, other-context, non-`regular` or archived → 422 "account not found"; a visible
    account with another currency → 422 "currency mismatch".
- Setting `dueDay` for the first time while `bills_from` is `null` and not sent sets
  `bills_from` to today (server UTC).
- (decided in #56) A `null` `bills_from` with `dueDay` set is treated as **no schedule** (no
  occurrences). A currency-changing account PATCH re-checks a stored default paying account
  (422 "currency mismatch" when it no longer matches).

## One-off bills

`Bill` (`bank_bills` table):

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `providerAccountId` | yes | yes | A `provider_expense` account of the active owner; gives the bill its owner. Real FK, `ON DELETE CASCADE` |
| `payingAccountId` | yes on create | yes | A `regular`, non-archived account of the same owner and the same currency as the provider. Real FK, `ON DELETE SET NULL`; when it is null the Pay dialog requires a choice |
| `dueDate` | yes | yes | `DATE`; may be in the past (so an already-overdue bill can be entered). **No weekend shift**: the date entered is the due date |
| `amount` | yes | yes | `BIGINT` minor units, > 0, in the provider account's currency, within the amount bound (10¹³ minor units) and currency decimals of [transactions.md](accounts/transactions.md#currency) |
| `description` | yes | yes | Trimmed, max 255 characters |
| `notes` | no | yes | Free text, max 2000 characters |

- Changing `providerAccountId` re-checks the currency of the paying account (422 on mismatch).
- (decided in #56) **Editing a bill that has a payment row** — changing the provider of a `paid`
  bill → **409 `BILL_PAID`** (undo first). Otherwise the payment row follows the bill: its
  source account and due date are updated in the same DB transaction. A provider change also
  rescales a stored amount into the new provider's currency exponent (400 when it cannot be
  represented).
- (decided in #56) An **archived provider** in a bill body → 422 "account not found", like any
  other invalid body reference.
- A one-off bill has no owner columns: its owner is its provider account's owner.

### Expected amount and currency

- A derived occurrence's **expected amount** is `instalmentAmount` (debt) or `expectedAmount`
  (provider). When it is unset, the occurrence still shows, **with no expected amount**, and the
  Pay dialog requires an amount.
- **Currency** — a payment writes the same amount to both accounts, so the paying account must
  have the **source account's currency** (one currency per account, no conversion). A visible
  same-owner account with a different currency → **422 "currency mismatch"**. This allows no
  existence probing: the account is already visible to the caller.

## Recurrence model

Applies to occurrences derived from debt and provider-expense accounts:

- **Frequencies** — only what [#30](https://github.com/darthjee/ward/issues/30) /
  [#32](https://github.com/darthjee/ward/issues/32) expose: `monthly`, or `yearly` (`dueDay`
  plus `dueMonth`). No other periods.
- **A schedule exists** when `dueDay` is set, `showInCalendar` is `true` and the account is not
  archived.
- **Start — `billsFrom`.** The first occurrence is the first due date **on or after
  `billsFrom`**. The account's opening date is **not** used, so a loan opened years ago does not
  produce a backlog of phantom overdue instalments.
- **End — open-ended.** Occurrences stop only when the account is **archived** or
  `showInCalendar` is `false`. `instalmentCount` stays informational and the balance reaching
  zero is not a stop condition either.
- **Nonexistent days — clamp to the month's last day.** `dueDay` 29–31 → the last day of shorter
  months (31 → 30 Apr; 29–31 → 28 Feb, or 29 Feb in leap years). Yearly 29 Feb → 28 Feb in
  non-leap years. Always **exactly one occurrence per period**.
- **Weekends — shift to the next Monday.** An occurrence falling on Saturday or Sunday has an
  **effective** due date on the following Monday. No holiday handling and no per-account rule
  (see the *Business-day calendar for bills* [Future epic](README.md#future-epics)).
- **Nominal vs effective date** — the **nominal** due date is the date after clamping, before
  the weekend shift. Payments are keyed by the nominal date. The effective date is used only for
  display and for the overdue check, so changing the shift rule later never orphans a payment.
  One-off bills have no shift: nominal and effective dates are both `dueDate`.
- **Archived accounts produce no occurrences** — past or future; their unpaid overdue
  occurrences disappear too. Payments already recorded stay in `bank_bill_payments` and reappear
  if the account is unarchived.
- **`billsFrom` lifecycle** — set to today when `dueDay` is first set; **kept** when `dueDay` is
  cleared, so re-enabling the schedule does not reset its start nor resurrect old occurrences as
  overdue; editable by the user for a fresh start.

## Occurrence shape

The Calendar routes return derived occurrences and one-off bills as one shape (`snake_case`):

| Field | Notes |
|---|---|
| `kind` | `debt`, `provider` (derived) or `bill` (one-off) |
| `source_account` | `{ id, name, type }` — the debt / provider account (for a one-off, its provider) |
| `bill` | `{ id, description }` for one-offs, `null` otherwise |
| `nominal_date` | Key of the occurrence (one-offs: `dueDate`) |
| `effective_date` | After the weekend shift (one-offs: `dueDate`) |
| `expected_amount` | Decimal string in the account currency, or `null` when unset |
| `currency` | The source account's currency |
| `status` | `open`, `overdue`, `paid` or `skipped` |
| `payment` | For `paid` / `skipped`: `{ id, status, paid_on, amount, paying_account: { id, name } }`; `null` otherwise |
| `default_paying_account` | `{ id, name }` or `null` (the stored default, or the one-off's `payingAccountId`) |

Accounts are exposed by **id and name only**, never owner fields.

## Paying a bill

One `bank_bill_payments` row per occurrence. Paying writes the row and its ledger transactions in
**one DB transaction**: if any part fails, none of it is saved.

### Payment row (`bank_bill_payments`)

| Column | Notes |
|---|---|
| `sourceAccountId` | The debt / provider account (for a one-off, its provider). Real FK, `ON DELETE CASCADE` |
| `billId` | Nullable; set for one-offs. Real FK to `bank_bills`, `ON DELETE CASCADE` |
| `dueDate` | The **nominal** due date |
| `status` | `paid` \| `skipped` |
| `paidOn` | `DATE`, `paid` only; at most UTC today + 1 day, the same rule as transaction dates in [transactions.md](accounts/transactions.md#edge-cases), so the payment transactions are always valid (decided in #56) |
| `amount` | `BIGINT` minor units, > 0, `paid` only |
| `payingAccountId` | `paid` only. Real FK, `ON DELETE SET NULL` |
| `paymentTransactionId`, `withdrawalTransactionId`, `chargeTransactionId` | Nullable references to the transactions the payment created. Real FKs, `ON DELETE SET NULL` |

- **Uniqueness** — `(source_account_id, due_date)` where `bill_id` is null (derived
  occurrences); `(bill_id)` for one-offs. (decided in #56) The derived key is enforced by an
  indexed **virtual** generated column `derived_due_date` (`due_date` when `bill_id` is null)
  with `UNIQUE (source_account_id, derived_due_date)`; MySQL refuses a stored generated column
  whose base column carries an `ON DELETE CASCADE` FK.
- The row carries no owner columns: it inherits the owner from its source account.

### Ledger effect of `paid`

- **Debt** — a payment (**+**) on the debt account and a withdrawal (**−**) on the paying
  account.
- **Provider (derived or one-off)** — a payment (**+**) on the provider account and a withdrawal
  (**−**) on the paying account. A charge (**−**) on the provider account is added too, through
  an **"Also record the charge"** checkbox (`recordCharge`, on by default; turned off when the
  charge was already entered by hand). The charge feeds the accountant hand-off like any charge
  (see [provider-expense.md](accounts/provider-expense.md#business-expenses-for-the-accountant)).
  This resolves the charge-vs-payment question #32 flagged.
- The transactions are **ordinary transactions**: dated `paidOn`, described
  `"<bill description | account name> — <nominal due date>"`, and editable later like any other.
  (decided in #56) When the text would exceed 255 characters, only the label is truncated (by
  code points); the ` — YYYY-MM-DD` suffix is always kept, so a long name never makes the
  payment fail.
- **Paid amount ≠ expected** — allowed; the actual amount is recorded. **No partial payments**:
  one payment per occurrence, which closes it.

### Skip and undo

- **Skip** — `status: skipped`, with no transactions and no amount. A skipped occurrence is
  neither open nor overdue.
- **Undo** — deleting the payment row also deletes the transactions it created **that still
  exist**, in the same DB transaction; the occurrence becomes open / overdue again. Skips are
  undone the same way.
  - (decided in #56) Undo answers `204`; undoing when there is no payment → 404.
  - (decided in #56) **Archived accounts** — undoing a `paid` payment whose source account or
    paying account is archived → **409 `ACCOUNT_ARCHIVED`**, consistent with the read-only
    ledger; the user unarchives first. Undoing a skip is allowed, unless the source account is
    archived (→ 404: the occurrence does not exist). A one-off whose provider is archived → 404,
    like any hidden occurrence.
  - (decided in #56) **Sent charge** — undo deletes the recorded charge even when it was already
    sent to the accountant ("the transactions it created that still exist"); the frontend (#57)
    warns, as #55 does for a manual delete.
  - (decided in #56) Undo finds the row by account and nominal date with **no schedule check**,
    so an off-schedule payment can still be undone; paying keeps the strict 404.
- **Deleting a one-off bill** with a `paid` payment → **409** (undo the payment first). A bill
  that is unpaid or skipped is hard-deleted together with its payment row.

## Routes and permissions

`<base>` is `/api/bank` or `/api/orgs/:orgId/bank` (see
[regular.md](accounts/regular.md#routes-and-permissions)), and every route uses
`@OwnerScoped()`. Responses are `snake_case`.

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `<base>/calendar.json?from=&to=` | Occurrences (derived + one-off) whose effective date is in the range, in the [occurrence shape](#occurrence-shape), plus per-currency totals. The range is at most **366 days**, otherwise 400 | `user-scoped` |
| GET | `<base>/calendar/overdue.json` | Every overdue occurrence, oldest first, plus per-currency totals | `user-scoped` |
| GET | `<base>/bills.json` | List one-off bills | `user-scoped` |
| POST | `<base>/bills.json` | Create a one-off bill | `never` |
| GET | `<base>/bills/:id.json` | Show a one-off bill | `user-scoped` |
| PATCH | `<base>/bills/:id.json` | Edit a one-off bill | `never` |
| DELETE | `<base>/bills/:id.json` | Delete a one-off bill (409 when paid) | `never` |
| POST | `<base>/accounts/:accountId/occurrences/:dueDate/payment.json` | Pay or skip a derived occurrence (`:dueDate` = nominal date, `YYYY-MM-DD`) | `never` |
| DELETE | `<base>/accounts/:accountId/occurrences/:dueDate/payment.json` | Undo a payment / skip | `never` |
| POST | `<base>/bills/:id/payment.json` | Pay or skip a one-off bill | `never` |
| DELETE | `<base>/bills/:id/payment.json` | Undo a payment / skip | `never` |
| GET | `<base>/accounts/:accountId/bill-payments.json` | Bill history of a debt / provider account, including [off-schedule](#edge-cases) payments | `user-scoped` |

- Generic account routes: the `debt` / `provider_expense` objects gain `bills_from`,
  `show_in_calendar` and `paying_account_id` (see
  [Schedule fields](#schedule-fields-on-source-accounts)). No other existing route changes.

### Responses (decided in #56)

- **Calendar envelope** — `calendar.json` answers `{ occurrences: [...], totals: [...] }`. The
  occurrences are in the [occurrence shape](#occurrence-shape), sorted by `effective_date`
  ascending; ties are broken by `kind`, then source account id, then bill id.
- **Overdue envelope** — `calendar/overdue.json` answers the same envelope, oldest first.
- **Totals** — one entry per currency, never summed across currencies, sorted by currency code.
  Amounts are decimal strings in the currency's exponent; a currency with no rows has no entry,
  and an empty range answers `totals: []`.
  - `calendar.json`: `{ currency, expected, paid, open }`. `expected` sums the expected amounts
    in the range; `paid` sums the actual paid amounts; `open` sums the expected amounts of open
    and overdue occurrences. Occurrences with no expected amount count toward neither `expected`
    nor `open`; skipped ones toward neither `paid` nor `open`.
  - `calendar/overdue.json`: `{ currency, open }` only.
- **Pagination** — `bills.json` and `bill-payments.json` reuse the ledger's `pagination` block
  (`page`, `per_page` 50, `total_pages`, `total_count`; an invalid `page` → 400).
  - `bills.json` answers `{ bills, pagination }`, newest `due_date` first, then `id` newest
    first. It takes an optional `provider_account_id` filter: an unknown, another owner's or
    non-provider id answers an empty list (never 404, no probing); a malformed one (not a
    positive integer) → 400. Bills of archived providers are left out.
  - `bill-payments.json` answers `{ payments, pagination }`, newest `due_date` first, then `id`.
    Each row is `{ id, status, paid_on, amount, paying_account, due_date, bill, off_schedule }`.
    `off_schedule` is `true` when `due_date` is not a nominal occurrence of the account's
    current schedule pattern (`due_day`, `due_month`, frequency, `bills_from`; `archived` and
    `show_in_calendar` are ignored, and with no `due_day` every derived row is off-schedule).
    The history of an archived account stays readable (`200`), like its ledger.
- **Bill response** — `{ id, provider_account: { id, name }, paying_account: { id, name } | null,
  due_date, amount, currency, description, notes, payment, created_at, updated_at }`, where
  `currency` is the provider's and `payment` has the occurrence's payment shape (or `null`). No
  owner fields.
- **Pay / skip** — `201` with the updated occurrence, in the occurrence shape. Check order: path
  404, then body 400, then paying-account 422, then the 409 for an existing payment
  (`OCCURRENCE_ALREADY_PAID`).

### Validation

- **Payment body** — `status` (`paid` | `skipped`); for `paid` also `paid_on`, `amount`,
  `paying_account_id`, and `record_charge` (providers only, default `true`). For `skipped` no
  other field is accepted. Body whitelist: unknown fields → 400; `record_charge` on a debt
  occurrence → 400.
- **Bill body** — the fields of [One-off bills](#one-off-bills), with their limits → 400 when
  outside (never truncated).
- **Account ids in a request body** (`provider_account_id`, `paying_account_id`) that are
  unknown, belong to another owner, live in the other context, have the wrong `type` (provider
  must be `provider_expense`, paying account must be `regular`) or are an **archived paying
  account** → **422 with one generic "account not found" error**, never saying which reason
  applied (no existence probing).
- **Ids in the path** (`:accountId`, `:id`) keep the **404, never 403** rule of
  [regular.md](accounts/regular.md#rules); a path account that is not a debt / provider → 404.
- **Non-occurrence date** — a `:dueDate` that does not match the schedule, is before
  `billsFrom`, or belongs to an account with `showInCalendar` `false` or archived → **404**.
- **Paying twice** → **409** (the unique key); undo first.
- **Currency mismatch** → **422 "currency mismatch"**.
- `calendar.json`: missing or invalid `from` / `to`, `from > to`, or a range over 366 days →
  400. (decided in #56) The cap is `to − from ≤ 366` days, the same rule as the accountant
  hand-off; a repeated parameter → 400 too; the errors carry `VALIDATION_FAILED`.

### Permissions and caching

- **Permissions** — every member of the owner context; no role checks (roles are stored but not
  enforced, as in the rest of `bank`). Enforcement belongs to the *Organization permission
  system* [Future epic](README.md#future-epics).
- **Caching** — every `GET` is `user-scoped` (declared with `@CachePolicy`, sent with
  `X-Skip-Cache`); every write is `never`. No Navi resources (nothing user-scoped is warmed).

## Data sensitivity & ownership

On top of the [Bank ownership contract](README.md#bank-ownership-contract):

1. **Owner** — a one-off `Bill` inherits its owner from its **provider-expense account**;
   `bank_bill_payments` inherits it from its source account (the debt / provider-expense account
   for derived occurrences, the provider-expense account for one-offs). No row stores an owner
   copy.
2. **Same owner only** — the paying account must belong to the **same owner** as the source
   account. Paying an organization's bill from a personal account is not possible in Ward; it
   stays two manual transactions, as for transfers.
3. **Body references → 422, path ids → 404** — see [Validation](#validation).
4. **Calendar is per context** — the Personal calendar shows personal bills only; an
   organization's calendar shows only that organization's bills. Totals are grouped per
   currency, never summed.
5. **Organization visibility** — every member sees and pays every bill of the organization.
6. **Responses** — no owner fields; a bill's accounts are exposed by id and name only.
7. **Free text** — bill descriptions / notes are personal financial data; request bodies are
   never logged, as for transactions.

## Owning module

- **`bank`** (lazy tier) — **no new module**. Bills load with the rest of the lazy `bank`
  module.
- **Tables** — `bank_bills` and `bank_bill_payments`, with real FKs to `bank_accounts`,
  `bank_bills` and `bank_transactions` (same module), plus the three columns added to
  `bank_debt_details` / `bank_provider_expense_details`.
- **Paying a bill is an in-module service call**: the payment row and the ledger transactions it
  records are written in **one DB transaction**. This resolves the "event or direct call" point
  left open in [regular.md](accounts/regular.md#owning-module) — **no event** is needed, and none
  is emitted or consumed.
- A future **cross-module calendar** reads bank occurrences through an exported service / DI
  token, **never events** (lazy listeners can miss events, see
  [modular-pattern.md](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/modular-pattern.md)).

### Backward compatibility

No `bank` code exists yet, so compatibility concerns the finished specs and the implementation
order:

- **Own migration** — if accounts ship before bills, the bills implementation adds
  `show_in_calendar` (`NOT NULL DEFAULT true`), `bills_from` (nullable) and `paying_account_id`
  (nullable FK) to the two details tables in **its own migration**; nothing is pre-added to the
  accounts migration.
- **Backfill** — accounts that already have `due_day` set get `bills_from` = the migration date,
  so existing schedules appear on the Calendar without a phantom overdue backlog.
- **API** — the `debt` / `provider_expense` objects gain three fields (additive); no other
  existing route changes.
- `product.md` needs nothing new: bills are already in `bank`'s planned purpose.

### Memory footprint

No idle cost: bills load with the lazy `bank` module. No new dependency: the date maths (clamp,
leap years, weekend shift) is a small pure helper.

### Performance

- Occurrences are computed **in memory per request**, with three queries: the owner's debt /
  provider accounts that have a schedule (`dueDay` set, `showInCalendar`, not archived), the
  payments in the range, and the one-off bills in the range.
- The 366-day cap bounds the work: a monthly schedule gives at most about 12 occurrences per
  account per range.
- Overdue goes back to `billsFrom` and only grows for occurrences left open — acceptable at
  personal scale.
- Indexes: `bank_bill_payments (source_account_id, due_date)`,
  `bank_bills (provider_account_id, due_date)`.

## Edge cases

1. **Schedule edits after payments** (`dueDay`, `dueMonth`, frequency or `billsFrom`) — always
   allowed. Payments that no longer match a nominal occurrence are **kept**, never deleted. They
   appear as **"off-schedule"** in the account's Bill history and not on the Calendar, and they
   reappear if the schedule changes back.
2. **Overdue** — open (not paid, not skipped) and effective due date < today. "Today" uses the
   server-UTC convention of [transactions.md](accounts/transactions.md#edge-cases).
3. **Archived paying account** — cannot be chosen for a new payment (generic 422). If it is the
   stored default, the Pay dialog requires another choice. Existing payments are unaffected.
4. **Archived provider** — its one-off bills disappear from the Calendar along with its derived
   occurrences, and reappear on unarchive.
5. **Pay for a date that is not an occurrence** → 404 (see [Validation](#validation)).
6. **Paying twice** → 409; undo first.
7. **Linked transaction edited or deleted by hand** — the payment row stays; undo only removes
   the transactions that still exist.
8. **Deleted paying account** — `ON DELETE SET NULL` on the default and on payment rows; the
   payment stays recorded.
9. **Deleted source account / bill** — its payment rows are removed (`ON DELETE CASCADE`); the
   account delete rule of [regular.md](accounts/regular.md#archive-vs-delete) still applies (409
   while it has transactions).

## Resolved questions

- [x] Whether bills are standalone or generated by debt / provider-expense accounts — hybrid:
  derived occurrences plus a one-off `Bill`; see [Summary](#summary).
- [x] The recurrence model — see [Recurrence model](#recurrence-model).
- [x] Marking a bill as paid (and whether paying records a transaction) — see
  [Paying a bill](#paying-a-bill).
- [x] Fields, routes, permissions and cache class for bills — see
  [Schedule fields](#schedule-fields-on-source-accounts), [One-off bills](#one-off-bills) and
  [Routes and permissions](#routes-and-permissions).
- [x] The `dueDay` 29–31 clamp deferred by [debt.md](accounts/debt.md#fields) and
  [provider-expense.md](accounts/provider-expense.md#fields) — see
  [Recurrence model](#recurrence-model).
- [x] Charge vs payment on the provider ledger, flagged by
  [provider-expense.md](accounts/provider-expense.md#charges-and-bills) — a payment plus an
  optional charge; see [Ledger effect of `paid`](#ledger-effect-of-paid).
- [x] Event vs direct call, left open by [regular.md](accounts/regular.md#owning-module) — an
  in-module service call; see [Owning module](#owning-module).

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/33
- Debt accounts (#30): https://github.com/darthjee/ward/issues/30,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/debt.md
- Provider-expense accounts (#32): https://github.com/darthjee/ward/issues/32,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/provider-expense.md
- Account routes and rules (#29): https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/regular.md
- Ledger, currency, transactions (#29): https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/transactions.md
- Realignment to the ownership model: https://github.com/darthjee/ward/issues/41
- Bank ownership contract: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/README.md#bank-ownership-contract
- Calendar UI: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/ui/calendar.md
- Modular pattern (lazy tier, events vs DI tokens): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/modular-pattern.md
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md

## Required tests

The frontend tests (including the new inputs on the Debts / Providers forms) are listed in
[ui/calendar.md](ui/calendar.md#required-tests).

**Backend — pure occurrence generator**

- Monthly and yearly schedules (`dueMonth` used only for yearly).
- `billsFrom` start: the first occurrence is the first due date on or after it; the opening date
  is ignored.
- Clamping: `dueDay` 31 → 30 Apr; 29–31 → 28 Feb in non-leap years and 29 Feb in leap years;
  yearly 29 Feb → 28 Feb in non-leap years; exactly one occurrence per period.
- Weekend shift: Saturday and Sunday → next Monday (effective date); the nominal date is
  unchanged.
- `showInCalendar` `false`, no `dueDay`, and archived accounts produce nothing (past or future).
- Open-ended: `instalmentCount` reached and zero balance do not stop occurrences.
- Range cap: over 366 days → 400.

**Backend — services and routes**

- Pay a debt occurrence: + payment on the debt, − withdrawal on the paying account, dated
  `paidOn`, with the described text.
- Pay a provider occurrence with and without `record_charge`: payment + withdrawal, plus the
  charge only when requested; the charge appears in the accountant hand-off.
- Atomic rollback: when any write fails, neither the payment row nor any transaction is saved.
- Skip writes no transactions; a skipped occurrence is neither open nor overdue.
- Undo deletes the payment row and only the linked transactions that still exist; the occurrence
  becomes open / overdue again.
- Paying twice → 409; a non-occurrence date (off-schedule, before `billsFrom`, hidden or archived
  account) → 404.
- One-off CRUD (field limits → 400); delete when paid → 409; delete when unpaid or skipped
  removes the bill and its payment row.
- Off-schedule payments after a schedule edit: kept, listed in `bill-payments.json`, absent from
  the Calendar, back when the schedule changes back.
- Currency mismatch → 422 "currency mismatch".
- Generic 422 "account not found" for body account ids: unknown, another owner, other context,
  wrong type, archived paying account — identical bodies.
- 404 with identical bodies for path ids (unknown, non-numeric, another owner, wrong context,
  non-member `:orgId`, non-debt / non-provider account).
- The owner-context matrix of [regular.md](accounts/regular.md#required-tests) on every bills /
  calendar route; the Personal calendar never shows organization bills and vice versa.
- No owner fields in any response; every `GET` sends `X-Skip-Cache`; writes are `never`.
- Payment body whitelist: unknown fields → 400; `record_charge` on a debt → 400.
- Schedule fields: `bills_from` set to today when `due_day` is first set, kept when `due_day` is
  cleared; `paying_account_id` validation (422 rules); `show_in_calendar` defaults to `true`.
- Migration: adds the three columns; backfills `bills_from` = migration date for accounts with
  `due_day` set, leaves it null otherwise.
