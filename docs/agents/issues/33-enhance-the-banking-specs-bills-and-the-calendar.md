# Issue: Enhance the banking specs: bills and the calendar

## Description

Part of Epic #26 (Bank module). Defines **bills and the Calendar** in the banking specs: where
bills come from, how they recur, how they are paid, and the Calendar submenu that shows them.
Every bill belongs to exactly one owner, the user (Personal) or an organization, through its
account (Bank ownership contract, #40). The spec is written against the specs realigned by #41
and finished by #29, #30 and #32. Documentation only — no code.

## Problem

`bills.md` and `ui/calendar.md` are still the #27 skeletons. The bill source, recurrence,
paying, Calendar views, routes, permissions and caching are all open. `accounts/debt.md`,
`accounts/provider-expense.md` and `accounts/regular.md` each defer a question to #33: the
`dueDay` clamp, the charge-vs-payment question on the provider ledger, and event vs direct call.

## Expected Behavior

- `bills.md` and `ui/calendar.md` are full specs: every skeleton open question is closed, and
  each keeps its **Reference** and **Required tests** sections (per `docs/agents/specs.md`).
- `accounts/debt.md`, `accounts/provider-expense.md` and `accounts/regular.md` get one-line
  pointers to `bills.md` only.
- The banking `README.md` gets updated index entries for `bills.md` and `ui/calendar.md`, the
  #33 sub-issue map row (including the pointer edits) and the new `## Future epics`, and the
  existing epics listed in Scope get "includes bills" notes.
- Implementation can start from the specs with no further product decision.

## Solution

### Bill source

Decided (hybrid model — derived sources plus a minimal `Bill` entity):

- **Recurring bills are derived, never stored.** Debt and provider-expense accounts are the only
  recurring bill sources: the Calendar computes their occurrences at render time from the fields
  #30 / #32 already expose (`instalmentAmount` / `expectedAmount`, frequency, `dueDay`,
  `dueMonth`). The schedule lives only on the account — no copy, no sync.
- **No standalone recurring bills.** A recurring payment always means creating a provider-expense
  (or debt) account.
- **One-off bills are a small `Bill` entity**, used only for what no account models (a yearly
  tax, a fine, a repair). Every `Bill` **always references a provider-expense account** — which
  gives it its owner, per the Bank ownership contract (child records inherit the owner through
  their account) — and is **tied to a paying account** (a regular account).
- **Opt-out flag:** debt and provider-expense accounts get a boolean `showInCalendar` (default
  `true`). When `false`, the account never produces Calendar occurrences, even with `dueDay` set.
  This adds a field to `bank_debt_details` / `bank_provider_expense_details` (or the common account
  fields — to be settled in the Bill fields topic).
- **One occurrence shape:** derived occurrences and one-off bills are merged by the Calendar into a
  single occurrence shape; payments are stored in one table keyed by (source, due date) —
  details in the Paying a bill topic.

### Owning module

Decided:

- **Bills and the Calendar live inside the `bank` module** (lazy tier) — no new module.
  Tables use the `bank_` prefix: `bank_bills` (one-off bills) and `bank_bill_payments`, with
  real FKs to `bank_accounts` (same module).
- **Paying a bill is an in-module service call**: the payment row and any ledger transactions it
  records are written in **one DB transaction**. This resolves the "event or direct call" point
  left open in `accounts/regular.md` — no event is needed.
- **No events** emitted or consumed, consistent with the rest of `bank`.
- **No extra memory cost**: bills load with the rest of the lazy `bank` module.
- **New Future epics** (added to the banking `README.md` `## Future epics` list):
  - **Cross-module calendar** — a global agenda aggregating due dates from several modules
    (bank bills, later protocol follow-ups, car maintenance…). It reads bank occurrences through
    an exported service / DI token, **never events** (lazy listeners can miss events, see
    `architecture/modular-pattern.md`).
  - **Bill reminders / notifications** — e.g. email through the `mail` module before a bill is
    due; the epic decides the trigger (scheduled job vs event) and opt-in. Kept separate from the
    cross-module calendar.

### Recurrence model

Decided (applies to occurrences derived from debt and provider-expense accounts):

- **Frequencies** — only what #30 / #32 expose: `monthly` or `yearly` (`dueDay`, plus `dueMonth`
  when yearly). No other periods.
- **Start — new `billsFrom` date** on debt and provider-expense accounts. Defaults to **today** the
  first time `dueDay` is set and is editable. The first occurrence is the first due date
  **on or after `billsFrom`**. The account's opening date is **not** used, so a loan opened years
  ago does not produce a backlog of phantom overdue instalments.
- **End — open-ended.** Occurrences stop only when the account is **archived** or
  `showInCalendar` is `false`. `instalmentCount` stays informational (as #30 decided); the balance
  reaching zero is not a stop condition either.
- **Nonexistent days — clamp to the month's last day.** `dueDay` 29–31 → last day of shorter
  months (31 → 30 Apr; 29–31 → 28 Feb, or 29 Feb in leap years); yearly 29 Feb → 28 Feb in
  non-leap years. Always exactly one occurrence per period.
- **Weekends — shift to the next Monday.** An occurrence falling on Saturday or Sunday has an
  *effective* due date on the following Monday. No holiday handling and no per-account rule.
- **Payments are keyed by the nominal due date** (after clamping, before the weekend shift). The
  effective (shifted) date is used only for display and for the overdue check, so changing the
  shift rule later never orphans a payment.
- **Archived accounts produce no occurrences at all** — past or future (their unpaid overdue
  occurrences disappear too). Payments already recorded stay in `bank_bill_payments` and reappear
  if the account is unarchived.
- **New Future epic** — **Business-day calendar for bills**: national / regional holidays and a
  per-account non-business-day rule (`keep` / `next` / `previous`). The epic decides where the
  holiday data comes from and which country / region applies to an owner.

### Data sensitivity & ownership

Decided (on top of the Bank ownership contract):

1. **Owner** — a one-off `Bill` inherits its owner from its **provider-expense account**;
   `bank_bill_payments` inherits it from the bill's source account (the debt / provider-expense
   account for derived occurrences, the provider-expense account for one-offs). No row stores an
   owner copy.
2. **Same owner only** — the paying account must belong to the **same owner** as the source
   (provider-expense or debt) account. Paying an organization's bill from a personal account is
   not possible in Ward; it stays two manual transactions, as for transfers.
3. **Body references** — an account id in a **request body** that is unknown, belongs to another
   owner, lives in the other context, or has the wrong `type` (the provider must be
   `provider_expense`, the paying account must be `regular`) → **422 with one generic "account not
   found" error**, never saying which reason applied (no existence probing). Ids in the **path**
   keep the existing **404, never 403** rule.
4. **Calendar is per context** — the Personal calendar shows personal bills only; an
   organization's calendar shows only that organization's bills. Totals are grouped per currency,
   never summed.
5. **Organization visibility** — every member sees and pays every bill of the organization;
   roles are stored but not enforced, as in the rest of `bank` (enforcement belongs to the
   *Organization permission system* Future epic).
6. **Responses** — no owner fields; a bill's accounts are exposed by id and name only.
7. **Free text** — bill descriptions / notes are personal financial data; request bodies are
   never logged, as for transactions.

- **New Future epic** — **Combined calendar across owners**: one view of the bills of Personal
  and every organization the user belongs to ("everything I pay this month") — the first
  cross-owner view in `bank`. Must keep per-owner access checks and never expose owner fields.

### Backward compatibility

No `bank` code exists yet (`backend/src` has only `auth`, `core`, `database`, `health`,
`mail`), so compatibility is about the already-finished specs (#29, #30, #32) and the
implementation order.

Decided:

- **`bills.md` is the single source of truth for everything bill-related**, including the new
  `billsFrom`, `showInCalendar` and default `payingAccountId` columns (stored in `bank_debt_details` /
  `bank_provider_expense_details`), their migration, their inputs on the Debts / Providers
  create / edit pages and their validation. The bills implementation ships all of it.
- **Other specs get one-line pointers only** — no rewrite of their field tables, routes or tests:
  - `accounts/debt.md` — *Instalments and bills* and the `dueDay` 29–31 clamp note point to
    `bills.md` (resolved);
  - `accounts/provider-expense.md` — *Charges and bills* and the flagged charge-vs-payment
    question point to `bills.md` (resolved);
  - `accounts/regular.md` — the "No events… bills decide" bullet points to `bills.md` (in-module
    service call, no event).
  The #33 row of the banking `README.md` sub-issue map lists these pointer edits.
- **Own migration** — if accounts ship before bills, the bills implementation adds
  `show_in_calendar` (`NOT NULL DEFAULT true`), `bills_from` (nullable) and `paying_account_id` (nullable FK) in its own migration;
  nothing is pre-added to the accounts migration.
- **Backfill** — accounts that already have `dueDay` set get `bills_from` = the migration date, so
  existing schedules appear on the Calendar without a phantom overdue backlog.
- **`billsFrom` lifecycle** — set to today when `dueDay` is first set; **kept** when `dueDay` is
  cleared (re-enabling the schedule does not reset its start or resurrect old occurrences as
  overdue). Users can edit it directly for a fresh start.
- **API** — the `debt` / `provider_expense` objects on the generic account routes gain the three
  fields (additive); the body whitelists accept them as optional. No other existing route changes.
- `product.md` needs nothing new: bills are already in `bank`'s planned purpose.

### Bill fields

Decided.

**Schedule fields on the source accounts** — all stored in `bank_debt_details` /
`bank_provider_expense_details` (not the common account fields), owned by `bills.md`:

| Field | Notes |
|---|---|
| `billsFrom` | `DATE`, nullable. Set to today when `dueDay` is first set and kept when `dueDay` is cleared (see Backward compatibility). Editable |
| `showInCalendar` | boolean, `NOT NULL DEFAULT true` |
| `payingAccountId` | Nullable **default paying account**: a `regular`, non-archived account of the same owner and **same currency**. Pre-fills the Pay dialog and can be changed on each payment. Real FK, `ON DELETE SET NULL` |

**One-off `Bill` (`bank_bills`)**:

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `providerAccountId` | yes | yes | A `provider_expense` account of the active owner; gives the bill its owner. Real FK, `ON DELETE CASCADE` |
| `payingAccountId` | yes on create | yes | A `regular`, non-archived account of the same owner and the same currency as the provider. Real FK, `ON DELETE SET NULL`; when it is null the Pay dialog requires a choice |
| `dueDate` | yes | yes | `DATE`; may be in the past (so an already-overdue bill can be entered). No weekend shift: the date entered is the due date |
| `amount` | yes | yes | `BIGINT` minor units, > 0, in the provider account's currency, within the amount bound of `transactions.md` |
| `description` | yes | yes | Trimmed, max 255 characters |
| `notes` | no | yes | Free text, max 2000 characters |

- The derived occurrence's expected amount is `instalmentAmount` (debt) or `expectedAmount`
  (provider). If it is unset, the occurrence still shows, with no expected amount, and the Pay
  dialog requires an amount.
- **Currency** — a payment writes the same amount to both accounts, so the paying account must
  have the source account's currency (one currency per account, no conversion). A visible
  same-owner account with a different currency → **422 "currency mismatch"**. This does not
  allow existence probing, because the account is already visible to the caller.

### Paying a bill

Decided — one `bank_bill_payments` row per occurrence. Paying writes the row and its ledger
transactions in **one DB transaction**: if any part fails, none of it is saved.

- **Payment row (`bank_bill_payments`)**: `sourceAccountId` (debt / provider; real FK,
  `ON DELETE CASCADE`), `billId` (nullable, set for one-offs; real FK, `ON DELETE CASCADE`),
  `dueDate` (the **nominal** due date), `status` (`paid` | `skipped`), `paidOn` (`DATE`, not
  after today, as for transactions), `amount`, `payingAccountId`, and nullable references to
  the transactions it created (`paymentTransactionId`, `withdrawalTransactionId`,
  `chargeTransactionId`; `ON DELETE SET NULL`).
  - Uniqueness: `(source_account_id, due_date)` where `bill_id` is null; `(bill_id)` for
    one-offs.
- **Ledger effect of `paid`**:
  - **Debt** — a payment (**+**) on the debt account and a withdrawal (**−**) on the paying
    account.
  - **Provider (derived or one-off)** — a payment (**+**) on the provider account and a
    withdrawal (**−**) on the paying account. A charge (**−**) on the provider account is added
    too, through an **"Also record the charge"** checkbox (on by default; turned off when the
    charge was already entered by hand). The charge feeds the accountant hand-off like any
    charge. This resolves the charge-vs-payment question #32 flagged.
  - The transactions are ordinary transactions: they are dated `paidOn`, described
    `"<bill description | account name> — <nominal due date>"`, and can be edited later.
- **Paid amount ≠ expected** — allowed; the actual amount is recorded. **No partial
  payments**: one payment per occurrence, which closes it.
- **Skip** — `status: skipped`, with no transactions and no amount. A skipped occurrence is
  neither open nor overdue.
- **Undo** — deleting the payment row also deletes the transactions it created that still exist
  (same DB transaction), and the occurrence becomes open / overdue again. Skips are undone the
  same way.
- **Deleting a one-off bill** with a `paid` payment → **409** (undo the payment first). A bill
  that is unpaid or skipped is hard-deleted together with its payment row.

### Calendar UI

Decided — the **Calendar** submenu, `<ui>/calendar`, per context:

- **List view (default)**:
  - an **Overdue** section — every open occurrence whose **effective** due date is before
    today, back to `billsFrom` with no age limit, oldest first;
  - **Upcoming** — the next **60 days**, grouped by week;
  - per-currency totals (overdue / upcoming), never summed across currencies.
- **Month view** — a `<ui>/calendar/month?m=YYYY-MM` grid that can be browsed from any past
  month up to **12 months ahead**. Overdue entries are highlighted, and paid / skipped ones are
  shown muted.
- **Entry** — the source name (account name, or the bill description), the expected amount,
  the effective due date (the nominal date is shown too when the weekend shift moved it) and
  the status. It links to the **source account's detail page** (Debts / Providers) or to the
  **one-off bill's edit page**. Inline actions: **Pay** (a dialog with amount, `paidOn` = today,
  paying account pre-filled from the default, and the charge checkbox for providers), **Skip**,
  and **Undo** on paid / skipped entries.
- **Add bill** — a button on the Calendar and on the provider detail page (provider
  pre-selected) opens `<ui>/bills/new`; editing happens at `<ui>/bills/:id/edit`.
- **Debts / Providers** create / edit pages gain the `billsFrom`, `showInCalendar` and default
  paying-account inputs. The detail pages gain a **Bill history** list (payments and skips,
  including off-schedule ones).

### Edge cases

Decided:

- **Schedule edits after payments** (changes to `dueDay`, `dueMonth`, frequency or `billsFrom`)
  are always allowed. Payments that no longer match a nominal occurrence are **kept**, never
  deleted. They appear as **"off-schedule"** in the account's Bill history and not on the
  Calendar, and they reappear if the schedule changes back.
- **Overdue** = open (not paid, not skipped) and effective due date < today. "Today" uses the
  server-UTC convention of `transactions.md`.
- **Archived paying account** — cannot be chosen for a new payment (generic 422). If it is the
  stored default, the Pay dialog requires another choice. Existing payments are unaffected.
- **Archived provider** — its one-off bills disappear from the Calendar along with its derived
  occurrences, and reappear on unarchive.
- **Pay for a date that is not an occurrence** (a path date that does not match the schedule,
  is before `billsFrom`, or belongs to an account with `showInCalendar` false or archived) →
  **404**.
- **Paying twice** → **409** (the unique key); undo first.
- **Linked transaction edited or deleted by hand** — the payment row stays; undo only removes
  the transactions that still exist.

### Routes, permissions and caching

Decided. `<base>` is `/api/bank` or `/api/orgs/:orgId/bank`, and every route uses
`@OwnerScoped()`:

| Method | Route | Purpose |
|---|---|---|
| GET | `<base>/calendar.json?from=&to=` | Occurrences (derived + one-off) in the range, as one occurrence shape, plus per-currency totals. The range is at most **366 days**, otherwise 400 |
| GET | `<base>/calendar/overdue.json` | Every overdue occurrence |
| GET / POST | `<base>/bills.json` | List / create one-off bills |
| GET / PATCH / DELETE | `<base>/bills/:id.json` | Show / edit / delete a one-off bill |
| POST / DELETE | `<base>/accounts/:accountId/occurrences/:dueDate/payment.json` | Pay or skip / undo a derived occurrence (`:dueDate` = nominal date) |
| POST / DELETE | `<base>/bills/:id/payment.json` | Pay or skip / undo a one-off bill |
| GET | `<base>/accounts/:accountId/bill-payments.json` | Bill history of a debt / provider account, including off-schedule payments |

- Payment body: `status` (`paid` | `skipped`); for `paid` also `paidOn`, `amount`,
  `payingAccountId` and `recordCharge` (providers only, default `true`). Body whitelist; unknown
  fields → 400.
- Generic account routes: the `debt` / `provider_expense` objects gain `billsFrom`,
  `showInCalendar` and `payingAccountId` (additive and optional).
- **Permissions** — every member of the owner context; no role checks (see Data sensitivity &
  ownership).
- **Caching** — every GET is `user-scoped` with `X-Skip-Cache`, and every write is `never`. No
  Navi resources (nothing user-scoped is warmed).

### Performance and memory

- Occurrences are computed **in memory per request**: one query for the owner's
  debt / provider accounts that have a schedule (`dueDay` set, `showInCalendar`, not archived),
  one for payments in the range, and one for one-off bills in the range. The 366-day cap bounds
  the work: monthly schedules give at most about 12 occurrences per account per range.
- Overdue goes back to `billsFrom` and only grows for occurrences left open, which is
  acceptable at personal scale.
- Indexes: `bank_bill_payments (source_account_id, due_date)`, `bank_bills (provider_account_id,
  due_date)`.
- No new dependency: date maths (clamp, leap years, weekend shift) is a small pure helper. No
  idle cost, because `bank` is lazy.

### Testing strategy

`bills.md` and `ui/calendar.md` each list their **Required tests**. At minimum:

- **Backend, pure occurrence generator**: monthly / yearly; `billsFrom` start (first occurrence
  on or after); clamping 29–31 and 29 Feb in leap / non-leap years; Saturday / Sunday → Monday;
  `showInCalendar` false and archived produce nothing; open-ended (no `instalmentCount` /
  zero-balance stop); range cap.
- **Backend, services / routes**:
  - pay debt / provider (with and without the charge) writes the expected transactions;
  - atomic rollback when a write fails;
  - skip, undo (deletes only the linked transactions that still exist), paying twice → 409,
    non-occurrence date → 404;
  - one-off CRUD and delete-when-paid → 409;
  - off-schedule payments after a schedule edit;
  - currency mismatch → 422;
  - generic 422 for body account ids (unknown / other owner / other context / wrong type /
    archived paying account);
  - 404 for path ids;
  - the owner-context matrix of `regular.md`; no owner fields in responses; `X-Skip-Cache` on
    every GET;
  - migration and backfill of `bills_from`.
- **Frontend (Jasmine)**: list view (Overdue section, 60-day upcoming, per-currency totals);
  month view navigation and its 12-month limit; Pay dialog defaults and the charge checkbox
  shown for providers only; Skip / Undo; Add / edit bill form validation; new inputs on the
  Debts / Providers forms; Bill history with off-schedule entries; escaped descriptions.

### Scope and Future epics

**In scope:**

- Bills: derived occurrences from debt / provider-expense accounts, the one-off `Bill` entity,
  `billsFrom` / `showInCalendar` / default `payingAccountId`, the recurrence rules, paying / skipping / undoing occurrences.
- The **Calendar** submenu: views, horizon, overdue, links.
- Routes, permissions, cache class, and the **Required tests** of `bills.md` and `ui/calendar.md`.
- Pointer edits in `accounts/debt.md`, `accounts/provider-expense.md`, `accounts/regular.md`, and
  the banking `README.md` (index entries, #33 sub-issue map row, `## Future epics`).

**Out of scope — existing Future epics** (each gets a one-line note that it **includes bills**
where it doesn't already say so; no new entries):

| Concern | Existing Future epic |
|---|---|
| Credit card statements as bills | *Credit card accounts* |
| Categories on bills | *Categories* |
| Receipts on paid bills | *Receipts / attachments* |
| Paying a bill as one linked operation | *Linked transfers* |
| Totals across currencies | *Currency conversion* |
| Who may create / pay / delete bills | *Organization permission system* |

**New Future epics** (added to the banking `README.md` `## Future epics`):

1. **Cross-module calendar** — see Owning module.
2. **Bill reminders / notifications** — see Owning module.
3. **Business-day calendar for bills** — holidays and a per-account non-business-day rule; see
   Recurrence model.
4. **Combined calendar across owners** — see Data sensitivity & ownership.
5. **Calendar feed (iCal / `.ics`)** — subscribe to bills from an external calendar app. Needs a
   feed URL with a secret token — a new authentication path outside the JWT session — so the
   epic must cover token issuance / revocation and what the feed may expose.
6. **Automatic bill import** — Open Finance, boleto barcode / PDF reading. External integrations
   and memory cost (512 MB free tier); low priority.
7. **Projected balance** — current vs projected balance using upcoming bills (ties to the
   future-dated transactions note in `accounts/transactions.md`).

**Explicitly out of the product (not an epic):**

- **Auto-pay / payment execution** — Ward records what happens; it never moves money.

**Decided against (not deferred):**

- Standalone recurring bills — a recurring payment always means a provider-expense account.
- Periods other than `monthly` / `yearly`.

## Benefits

- One place (the Calendar) answers "what do I have to pay, and what is late?" for each owner.
- Recurring schedules live only on the accounts, so there is no data to keep in sync.
- Paying a bill keeps the debt / provider / regular ledgers and the accountant hand-off
  consistent in a single atomic step.
