# Write the full provider-expense spec

Replace the #27 stub in `docs/agents/specs/banking/accounts/provider-expense.md` with a full
spec that closes every stub open question. Mirror the section layout and tone of `debt.md` /
`investment.md`, transcribing the decisions of the issue's Solution section:

1. **Header blockquote** — "Owned by #32. Builds on #29: reuses the common account fields, name
   uniqueness, archive vs delete and account routes of regular.md, and the ledger, opening
   anchor, currency and transaction routes of transactions.md. Adds only what is specific to
   provider-expense accounts."
2. **Summary** — one `provider_expense` account per provider; exactly one owner (user or
   organization), details and charges inherit it through the account; not in the main
   Accounts list, own **Providers** submenu; plain ledger.
3. **Scope** — in: model, fields, accountant hand-off, charges and bills exposure, Providers
   pages, routes / permissions / caching. Out: linked transfers, bill generation (#33),
   receipts / attachments and PDF export (new Future epics), refunds export (Categories),
   reconciliation locks, currency conversion.
4. **Ledger and balance** — charge = negative, payment = positive; balance = what is still owed
   (`0` settled, positive = credit, allowed, no warning); opening anchor = amount outstanding
   when recording starts (usually `0`), not forced negative. Include an
   **Alternatives considered** subsection with the rejected expense-log and `Provider`-entity
   models.
5. **Fields** — common fields with provider labels (`bankName` → "Provider", `accountNumber` →
   "Customer / contract number", still masked; `branch` optional); the
   `bank_provider_expense_details` 1:1 table (`forAccountant`, `providerTaxId`,
   `expectedAmount`, `dueDay`, `dueMonth`, `chargeFrequency`) with types and rules from the
   issue; `sentToAccountantAt` on `bank_transactions` (nullable `DATETIME`, set only by Mark as
   sent, returned only for charges of provider-expense accounts; 1:1 side table rejected); the
   "Not added" list (`kind`, `provider`, charge-payment link).
6. **Recording charges and payments** — generic transactions and routes; no `kind` column;
   **Add charge** (negative, suggests `expectedAmount`) / **Add payment** (positive) frontend
   shortcuts; paying from a regular account = two manual transactions until *Linked
   transfers*.
7. **Business expenses for the accountant** (anchor `#business-expenses-for-the-accountant`) —
   per-account `forAccountant` flag (default `true`); every charge on a flagged account is a
   business expense, payments never; client-side CSV for a date range of the active owner
   (columns: date, provider, description, amount, currency, plus `provider_tax_id`);
   **Mark as sent** stamps exactly the previewed ids; unsent-only default; edit / delete of a
   sent charge allowed with a warning; available in both contexts. Subsections:
   **Receipts / attachments** (out of scope, Future epic) and **Refunds** (not exported,
   Categories Future epic). List the rejected alternatives (per-transaction flag, "all
   accounts for the accountant", `bank_accountant_exports` record, no tracking, server CSV
   route, `isRefund` / `kind`, dedicated Refunds epic).
8. **Charges and bills** — exposes `expectedAmount`, `chargeFrequency`, `dueDay`, `dueMonth`,
   `forAccountant`, computed balance, opening date, archived state; stores no bill rows; a
   balance ≥ 0 is not a stop condition; flag for #33 whether paying a bill records a charge,
   a payment or both.
9. **Providers submenu UI** — `### List` (`<ui>/providers`), `### Detail`
   (`<ui>/providers/:accountId`, ledger + Add charge / Add payment, per-charge
   "Mark as unsent", warning on editing / deleting a sent charge), `### Create / Edit`
   (`<ui>/providers/new`, `<ui>/providers/:accountId/edit`; Provider / Customer number labels,
   provider fields, `dueMonth` shown only for yearly), `### Accountant hand-off`
   (`<ui>/providers/accountant`: date range defaulting to the last full month from the
   browser's local date, "unsent only" on, preview list, per-currency totals, Download CSV,
   Mark as sent disabled on empty preview). Path on the first line under each plain heading,
   as in debt.md.
10. **Routes and permissions** — reuse generic account routes with a nested
    `provider_expense` object (`for_accountant`, `provider_tax_id`, `expected_amount`,
    `charge_frequency`, `due_day`, `due_month`); route table in the debt.md style; the three
    hand-off routes table (`GET /accountant/charges.json`, `POST /accountant/mark-sent.json`,
    `POST /accountant/mark-unsent.json`) with cache classes. `### Validation` (as debt, plus
    the hand-off validations: range, 366-day cap, 1000-row / 1000-id caps, empty list,
    all-or-nothing 404 / 400). `### Permissions and caching` (user-scoped GETs with
    `X-Skip-Cache`, `never` writes, nothing in Navi; 404 never 403; bodies never accept
    `userId`, `organizationId`, `sentToAccountantAt`).
11. **Performance & security** — CSV formula-injection escaping on text cells only, CSV format
    (UTF-8 BOM, comma, `.` decimal, ISO dates, `ward-accountant-<from>-<to>.csv`), one-query
    ownership resolution in the mark routes inside a DB transaction, caps, index reuse of
    `bank_transactions (account_id, date, id)`, idempotent `UPDATE … AND
    sent_to_accountant_at IS NULL`, no rate limit.
12. **Data sensitivity & ownership**, **Owning module** (`bank`, lazy, `@OwnerScoped()`), with
    **Backward compatibility** and **Memory footprint** subsections.
13. **Edge cases** — the 14 numbered cases of the issue, grouped (Marking as sent / What is
    exported / Account and ledger), including the archived-account exception for mark sent /
    unsent.
14. **Resolved questions** — each former stub open question with its answer and a link to the
    section that resolves it; "whether provider-expense accounts generate bills" becomes
    "left to #33 — see Charges and bills".
15. **Reference** — Epic #26, owning sub-issue #32, related #29, #30, #33, #40, #41.
16. **Required tests** — the issue's Required tests list verbatim in structure (Account routes,
    Transactions, Hand-off preview, Mark sent / unsent, DB, UI), noting that regular.md holds
    the full owner-context matrix.

## Files to Change

- `docs/agents/specs/banking/accounts/provider-expense.md` — full rewrite replacing the stub.
