# Write the bills spec

Replace the #27 skeleton in `docs/agents/specs/banking/bills.md` with the full spec. Use the
section layout of `accounts/provider-expense.md`. Change the header note to "Owned by #33"
(drop "Skeleton written by #27"). Every decision below comes from the issue's Solution section.
Write them down as decisions, not code.

Sections to write:

1. **Summary / Scope**: the hybrid model.
   - Recurring bills are derived from debt and provider-expense accounts (the only recurring
     sources) and are never stored.
   - There are no standalone recurring bills.
   - One-off `Bill` entity for what no account models (yearly tax, fine, repair).
   - One occurrence shape merges derived occurrences and one-off bills.
   - In / out of scope, linking the README Future epics.
   - Decided-against items: standalone recurring bills, periods other than monthly / yearly.
   - Explicitly out of the product: auto-pay / payment execution.
2. **Schedule fields on source accounts**: the table for `billsFrom` (`DATE`, nullable),
   `showInCalendar` (`NOT NULL DEFAULT true`) and `payingAccountId`.
   - All three are stored in `bank_debt_details` / `bank_provider_expense_details`.
   - `payingAccountId` is nullable, must be a regular, non-archived account with the same owner
     and the same currency, and is a real FK with `ON DELETE SET NULL`.
   - Their inputs on the Debts / Providers create / edit pages, and their validation.
   - The `debt` / `provider_expense` objects on the generic account routes gain these three
     fields (additive). The body whitelist accepts them as optional.
3. **One-off `Bill` (`bank_bills`)**: the field table.
   - `providerAccountId`: required, provider_expense, FK `ON DELETE CASCADE`.
   - `payingAccountId`: required on create, FK `ON DELETE SET NULL`.
   - `dueDate`: may be in the past, no weekend shift.
   - `amount`: BIGINT minor units, > 0, in the provider currency, within the `transactions.md`
     bound.
   - `description`: trimmed, max 255.
   - `notes`: max 2000.
   - Expected amount for derived occurrences: `instalmentAmount` / `expectedAmount`. When it is
     unset, the occurrence shows with no amount and the Pay dialog requires one.
   - Currency rule: a visible account with a different currency gets 422 "currency mismatch".
4. **Recurrence model**:
   - Frequencies: `monthly` / `yearly` (`dueDay`, plus `dueMonth`).
   - Start: `billsFrom`. The first occurrence is on or after it. The opening date is not used.
   - Open-ended. Occurrences stop only on archive or when `showInCalendar` is false.
     `instalmentCount` and a zero balance are not stop conditions.
   - Clamp 29–31 to the month's last day (31 → 30 Apr; 29–31 → 28/29 Feb). Yearly 29 Feb → 28 Feb
     in non-leap years. Exactly one occurrence per period.
   - Weekend: Saturday / Sunday shift to the next Monday (the effective date). No holidays.
   - Nominal vs effective date. Payments are keyed by the nominal date. The effective date is
     only for display and the overdue check.
   - Archived accounts produce no occurrences (past or future). Their payments are kept and
     reappear on unarchive.
   - `billsFrom` lifecycle: set to today when `dueDay` is first set, kept when `dueDay` is
     cleared, editable.
5. **Paying a bill**: the `bank_bill_payments` row.
   - Columns: `sourceAccountId` (FK CASCADE), `billId` (nullable, FK CASCADE), `dueDate`
     (nominal), `status` `paid` | `skipped`, `paidOn` (not after today), `amount`,
     `payingAccountId`, and `paymentTransactionId` / `withdrawalTransactionId` /
     `chargeTransactionId` (SET NULL).
   - Uniqueness: `(source_account_id, due_date)` where `bill_id` is null; `(bill_id)` for
     one-offs.
   - Ledger effects, all in one DB transaction:
     - debt: + payment on the debt, − withdrawal on the paying account;
     - provider: + payment, − withdrawal, plus an optional − charge ("Also record the charge",
       default on). This resolves the #32 flag. The charge feeds the accountant hand-off.
   - Transaction description: `"<bill description | account name> — <nominal due date>"`. The
     transactions are dated `paidOn` and stay editable.
   - The paid amount may differ from the expected amount. No partial payments.
   - Skip: no transactions, no amount. A skipped occurrence is neither open nor overdue.
   - Undo deletes the row plus the linked transactions that still exist, in the same DB
     transaction.
   - Deleting a one-off bill that has a `paid` payment returns 409. An unpaid or skipped bill is
     hard-deleted along with its payment row.
6. **Routes and permissions**: the route table under `<base>` with `@OwnerScoped()`.
   - `calendar.json?from=&to=`: the range is at most 366 days, otherwise 400.
   - `calendar/overdue.json`.
   - `bills.json` (GET / POST) and `bills/:id.json` (GET / PATCH / DELETE).
   - `accounts/:accountId/occurrences/:dueDate/payment.json` (POST / DELETE).
   - `bills/:id/payment.json` (POST / DELETE).
   - `accounts/:accountId/bill-payments.json`.
   - The occurrence response shape. Accounts are exposed by id and name only, with no owner
     fields.
   - `### Validation`:
     - payment body whitelist (`status`; for paid also `paidOn`, `amount`, `payingAccountId`,
       `recordCharge` for providers only, default true); unknown fields → 400;
     - body account ids → one generic 422 "account not found" for unknown / other owner / other
       context / wrong type / archived paying account;
     - path ids → 404, never 403;
     - non-occurrence date → 404;
     - paying twice → 409;
     - currency mismatch → 422.
   - `### Permissions and caching`:
     - every member of the owner context; roles not enforced;
     - every GET is `user-scoped` with `X-Skip-Cache`, writes are `never`;
     - no Navi resources.
7. **Data sensitivity & ownership**: the 7 decided points.
   - Owner inherited through the provider / source account; no owner copy.
   - Same owner only.
   - 422 vs 404 rule.
   - Calendar per context; totals per currency.
   - Organization visibility.
   - No owner fields in responses.
   - Request bodies are never logged.
8. **Owning module**:
   - `bank` module (lazy); `bank_` tables with real FKs to `bank_accounts`.
   - In-module service call in one DB transaction, with no events emitted or consumed. This
     resolves the `regular.md` open point.
   - A cross-module calendar later reads through an exported service / DI token, never events.
   - `### Backward compatibility`:
     - no bank code exists yet;
     - own migration adding `show_in_calendar`, `bills_from` and `paying_account_id`;
     - backfill `bills_from` = the migration date for accounts with `dueDay` set;
     - additive API change.
   - `### Memory footprint`: loads with lazy `bank`; no new dependency (pure date helper).
   - **Performance**:
     - in-memory computation per request;
     - three queries (scheduled accounts, payments in the range, one-off bills in the range);
     - the 366-day cap bounds the work;
     - indexes `bank_bill_payments (source_account_id, due_date)` and
       `bank_bills (provider_account_id, due_date)`.
9. **Edge cases**:
   - Schedule edits after payments: allowed; off-schedule payments are kept, shown in Bill
     history and not on the Calendar, and reappear if the schedule changes back.
   - Overdue = open and effective date < today (server UTC, per `transactions.md`).
   - Archived paying account.
   - Archived provider hides its one-off bills.
   - Non-occurrence date → 404.
   - Paying twice → 409.
   - Linked transaction edited or deleted by hand: the payment row stays.
10. **Resolved questions**: mark the four skeleton open questions as resolved, with links to the
    sections above. Also list the items the account specs deferred: the `dueDay` clamp from
    debt.md, charge-vs-payment from provider-expense.md, event vs direct call from regular.md.
11. **Reference**: GitHub URLs only.
    - Epic #26 and issues #33, #30, #32, #41.
    - Blob URLs for `accounts/debt.md`, `accounts/provider-expense.md`, `accounts/regular.md`,
      `accounts/transactions.md`, `ui/calendar.md`, `docs/agents/architecture/modular-pattern.md`
      and `docs/agents/specs.md`.
12. **Required tests**: the backend list from the issue's Testing strategy.
    - **Pure occurrence generator**: monthly / yearly, `billsFrom` start, clamping 29–31 and
      29 Feb in leap / non-leap years, Saturday / Sunday → Monday, `showInCalendar` false and
      archived produce nothing, open-ended, range cap.
    - **Services / routes**:
      - pay debt / provider (with and without the charge) writes the expected transactions;
      - atomic rollback when a write fails;
      - skip, and undo deleting only the existing linked transactions;
      - paying twice → 409, non-occurrence date → 404;
      - one-off CRUD, and delete-when-paid → 409;
      - off-schedule payments after a schedule edit;
      - currency mismatch → 422;
      - generic 422 for body account ids, 404 for path ids;
      - the owner-context matrix of `regular.md`;
      - no owner fields in responses, `X-Skip-Cache` on every GET;
      - migration and backfill of `bills_from`.
    - The frontend tests for the new inputs on the Debts / Providers forms can live here or in
      `ui/calendar.md`. Pick one and cross-link the other.

## Files to Change
- `docs/agents/specs/banking/bills.md` — replace the skeleton with the full bills spec
  described above.
