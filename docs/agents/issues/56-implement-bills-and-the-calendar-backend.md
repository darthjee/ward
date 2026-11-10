# Issue: Implement bills and the calendar — backend

## Description

Implement bills and the calendar in the `bank` backend module: the schedule fields on debt and
provider-expense accounts, the one-off `Bill` entity, the occurrence generator, the calendar and
overdue routes, pay / skip / undo, and the bill history. Everything ships in **one issue and one
PR** (decided: no split).

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

## Specs

- `docs/agents/specs/banking/bills.md` (all of it, including *Required tests*)
- `docs/agents/specs/banking/accounts/debt.md` and `provider-expense.md`: the `debt` /
  `provider_expense` objects that gain the schedule fields
- `docs/agents/specs/banking/accounts/transactions.md`: the date, amount and archived rules the
  payment transactions follow

## Scope

- **Schedule fields.** `bills_from`, `show_in_calendar` and the default `paying_account_id`
  (returned as `paying_account: { id, name }`) go on `bank_debt_details` /
  `bank_provider_expense_details`. They ship in **their own migration**, after
  `20261108120021-bank-add-transactions-sent-to-accountant-at`, with the `bills_from` backfill.
  The `debt` / `provider_expense` objects and their DTOs accept them as optional fields.
- **Tables.** `bank_bills` (one-off bills) and `bank_bill_payments`, with their FKs, unique keys
  and indexes as specified.
- **Occurrence generator.** A pure function covering:
  - monthly and yearly schedules;
  - the `billsFrom` start;
  - clamping to the month's last day;
  - Saturday / Sunday → Monday;
  - the nominal vs effective date.
- **Occurrences are computed per request; nothing is generated ahead of time.**
  - There is no worker, no cron and no scheduled job.
  - `calendar.json` and `calendar/overdue.json` compute occurrences in memory from three
    queries.
  - The only writes come from user actions: pay, skip, undo, and one-off bill CRUD.
- **Pay / skip / undo routes** for derived occurrences and one-off bills.
  - Each payment and its ledger transactions are written in one DB transaction.
  - Provider payments add the optional charge (`record_charge`).
- One-off bill CRUD, and the bill-history route (`bill-payments.json`).
- Error codes as specified: 409, 404, 422 and the 366-day range cap (400).
- A new controller (or controllers) mounted under both prefixes with
  `@OwnerScopedController('bank')`, like every bank controller. They are thin and delegate to
  services in the lazy `BankModule`.

## Decisions (points the spec leaves open)

Every rule in `bills.md` applies as written. In addition:

- **Calendar envelope.** `calendar.json` answers `{ occurrences: [...], totals: [...] }`:
  - occurrences are in the spec's occurrence shape, sorted by `effective_date` ascending;
  - ties are broken by `kind`, then source account id, then bill id.
- **Overdue envelope.** `calendar/overdue.json` answers the same envelope, oldest first.
- **Totals.** There is one entry per currency, never summed across currencies.
  - `calendar.json`: `{ currency, expected, paid, open }`.
    - `expected` is the sum of the expected amounts in the range.
    - `paid` is the sum of the actual paid amounts.
    - `open` is the sum of the expected amounts of open and overdue occurrences.
    - Occurrences with no expected amount count toward neither `expected` nor `open`.
    - Skipped occurrences count toward neither `paid` nor `open`.
  - `calendar/overdue.json`: `{ currency, open }` only.
  - Amounts are decimal strings in the currency's exponent.
  - A currency with no rows has no entry, and an empty range answers `totals: []`.
- **Pagination.** `bills.json` and `accounts/:accountId/bill-payments.json` reuse the ledger's
  `pagination` block (`page`, `per_page` 50, `total_pages`, `total_count`; an invalid `page` →
  400).
  - `bills.json` answers `{ bills, pagination }`, newest `due_date` first, then `id` newest
    first.
    - It takes an optional `provider_account_id` filter.
    - An unknown, another owner's or non-provider id in that filter → an empty list.
    - The filter never answers 404 and never allows probing.
  - `bill-payments.json` answers `{ payments, pagination }`, newest `due_date` first.
    - Each row has an `off_schedule` boolean, which is `true` when its `due_date` is not a
      nominal occurrence of the account's current schedule.
- **Bill response.** The bill response has these fields:
  - `id`;
  - `provider_account: { id, name }`;
  - `paying_account: { id, name }` or `null`;
  - `due_date`, `amount`, `currency` (the provider's), `description` and `notes`;
  - `payment` (same shape as in the occurrence) or `null`;
  - `created_at` and `updated_at`.

  It has no owner fields.
- **Pay / skip response.** `201` with the updated occurrence, in the occurrence shape.
- **Undo response.** `204`.
  - Undoing when there is no payment → 404.
- **Undo on archived accounts.** `409` when the source account or the payment's paying account
  is archived, consistent with the read-only ledger; the user unarchives first.
  - Undoing a skip is allowed, unless the source account is archived (→ 404: the occurrence
    does not exist).
  - A one-off whose provider is archived → 404, like any hidden occurrence.
- **Undo of a sent charge.** Undo deletes the recorded charge even when it was already sent to
  the accountant, as the spec says ("the transactions it created that still exist"). The
  frontend (#57) warns, as #55 does for a manual delete.
- **`paid_on` limit.** `paid_on` is at most UTC today + 1 day, the same rule as transaction dates
  in `transactions.md`, so the payment transactions are always valid.
- **Description text.** The payment transactions' description is
  `"<bill description | account name> — <nominal due date>"`, truncated to 255 characters if
  needed, so a long name never makes the payment fail.

## Docs

These are updated in the same PR as the code:

1. **`docs/agents/specs/banking/bills.md`.** Record each decision above next to the rule it
   refines, marked "(decided in #56)".
2. **`docs/agents/backend/routes/bank.md`.**
   - The schedule fields on the Debt and Provider-expense objects.
   - A *Bills and calendar* section covering the routes, bodies, replies, envelopes, totals,
     pagination, errors and cache classes.
   - The new controller(s) in the intro.
3. **`docs/agents/backend/routes.md`.** Add the new routes to the index, if it lists routes per
   module.

## Depends on

- #50 (debt accounts — backend), merged.
- #54 (provider-expense accounts — backend), merged.
- #71 (accountant hand-off — backend), merged. The recorded charge must feed the hand-off.

## Acceptance criteria

- The backend *Required tests* of `bills.md` are covered by Jest specs, and they pass. This
  includes:
  - atomic rollback;
  - the owner-context matrix;
  - the decisions above: totals, pagination, `off_schedule`, and undo on archived accounts.
- The existing bank specs (accounts, debts, investments, providers, transactions, hand-off)
  still pass unchanged.
- Lint passes.
- The `security`, `data-access` and `cache` reviews raise no unresolved violations.
