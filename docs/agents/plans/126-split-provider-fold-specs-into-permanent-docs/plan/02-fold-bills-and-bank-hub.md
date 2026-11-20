# Fold into `modules/bank/bills.md` and `modules/bank.md`

`bills.md` becomes the home of the provider-bill model.

**`modules/bank/bills.md`**

- **Intro and `## Scope`:** rewrite the hybrid-model description:
  - Debt schedules stay derived from the debt account.
  - Provider schedules are **stored on recurring provider bills**.
  - One-offs are provider bills with `kind = one_off`.
  - Replace the "No standalone recurring bills … Decided against, not deferred" bullet. A
    provider may hold several recurring bills, and every bill still belongs to a provider
    account (no bill without an account). Say that epic #119 reversed the earlier decision.
- **New `## Provider bills` section** (from `model.md` and `api/provider-bills.md`):
  - Entity `ProviderBill` / table `bank_provider_bills` (renamed from `bank_bills`), with the
    columns table.
  - No owner column.
  - Description uniqueness among recurring bills: case- and accent-insensitive, using the
    virtual `recurring_description` column.
  - The cap of 50 recurring bills per provider (`409 PROVIDER_BILL_LIMIT`). One-offs are
    uncapped and paginated.
  - Indexes.
  - Edge cases: provider archived, provider deleted, currency change rescale, renaming,
    `show_in_calendar: false`.
  - "No per-bill archiving", with a link to the step 01 epic.
- **`### Kinds`:** `recurring` / `one_off`, `kind` immutable (`409 PROVIDER_BILL_KIND_LOCKED`),
  the provider lock on recurring bills (`409 PROVIDER_BILL_PROVIDER_LOCKED`), and the
  validation matrix table (merged-state validation).
- **`## Schedule fields`:** describe the schedule both places it lives now:
  - Recurring provider bills: `expected_amount`, `charge_frequency`, `due_day`, `due_month`,
    `bills_from`, `show_in_calendar`, per-bill `paying_account_id`.
  - Debt accounts: unchanged.
  - Drop the "until #125" parenthesis in favour of a plain statement.
- **`## One-off bills`:** keep it, reworded as the `one_off` kind. Note that `bills.json`
  remains a compatibility projection (keeps `amount`) only if step 05's code check confirms it
  still exists.
- **New `### Payment keys`** under Paying (from `model.md`):
  - The three unique keys: debt `(source_account_id, due_date)` with the narrowed
    `derived_due_date`, recurring bill `(provider_bill_id, due_date)`, one-off `(bill_id)`.
  - The `provider_bill_id` FK with `ON DELETE CASCADE`.
  - The VIRTUAL / unmapped pitfall.
  - Per-bill row lock in the writer.
- **`## Recurrence`, `## Occurrence shape`, `## Bill history`:**
  - One series per recurring bill.
  - Add `source_bill: { id, description } | null` (never `notes`) to the occurrence table, and
    the sort tiebreak (bill id before source account id).
  - Off-schedule is computed per bill against that bill's own schedule.
  - Caps (366 days / 1000 occurrences) count total occurrences.
- **`## Data sensitivity and ownership`:** add the owner-only / no admin / org-members-full-
  access line (#81). Add the uniform `404` before any `409`.
- **`## Owning module` performance:** the calendar loads recurring bills in one query
  (`provider_account_id IN (…) AND kind = 'recurring'`).
- **`## Deferred`:** add the two step 01 epics.
- **Delete** the `## Provider bills API (#122)` and `## Contract step (#125)` stubs. Their
  content now lives in the sections above.

**`modules/bank.md`** (stale hub):

- Entity table: replace `Bill` / `bank_bills` with `ProviderBill` / `bank_provider_bills`
  ("recurring and one-off bills of a provider-expense account").
- Ownership contract list: `bank_bills` → `bank_provider_bills`.
- Routes section: nine controllers, adding `ProviderBillsController` and
  `ProviderBillPaymentsController`.
- Index row for `bills.md`: mention provider bills.

## Files to Change
- `docs/agents/modules/bank/bills.md` — rewrite scope, add provider bills / kinds / payment keys / schedule sections, drop stubs.
- `docs/agents/modules/bank.md` — entity table, ownership contract, controller list, index row.
