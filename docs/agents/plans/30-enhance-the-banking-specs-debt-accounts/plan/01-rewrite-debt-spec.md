# Rewrite accounts/debt.md

Replace the #27 skeleton with the full debt-account spec, mirroring the section layout of
`accounts/regular.md` so the fold sub-issue can merge them easily. Keep the header blockquote
naming #30 as owner (drop "Skeleton ... records only what is already decided"; say it builds on
#29's `regular.md` / `transactions.md`). Content, taken from the issue's `## Solution`:

1. **Summary** — a debt account models a loan: an `Account` with `type` `debt`, belonging to an
   organization, not shown in the main accounts list, with the regular ledger of
   `transactions.md` that usually starts negative and moves towards zero. Link to
   `README.md` (accounts) and `../ui/menu.md`.
2. **Scope** — in scope / out of scope lists (linked transfers, bill generation → #33, interest
   automation, credit cards → Future epic, currency conversion and categories → existing
   Future epics).
3. **Ledger and balance** — opening anchor = amount borrowed as a negative balance on the loan
   date, but zero / positive allowed; payments positive, interest entered manually as negative
   transactions; paid off = balance `0` with nothing special happening (no badge, no archive
   suggestion, no automatic action); overpayment allowed, no block, no warning.
4. **Fields** — all common fields of `regular.md#common-account-fields` apply; `bankName`
   reused as the creditor (labelled "Creditor"); `openingBalance` / `openingDate` are the
   original amount and start date (no `principal` / `startDate`). Table of the debt-specific
   optional fields stored in the 1:1 `bank_debt_details` table keyed by `account_id`:
   `interestRate`, `interestPeriod`, `instalmentAmount`, `dueDay`, `instalmentFrequency`
   (default `monthly`), `dueMonth`, `instalmentCount` — types and notes exactly as the issue.
   Sub-section **Credit cards**: same ledger mechanics but revolving, start at zero; a separate
   future `type` (e.g. `credit_card`), see Future epics.
5. **Recording payments** — generic `Transaction` entity and routes, no debt-specific entity;
   no `kind` column (Categories epic); UI shortcuts **Add payment** (positive, "Payment",
   `instalmentAmount` suggested) and **Add interest** (negative, "Interest"), purely frontend;
   plain inline add stays; no principal / interest split (worked example `-120` + `+500`);
   paying from a regular account = two manual transactions (Linked transfers epic).
6. **Instalments and bills** — left entirely to #33 (`../bills.md`); list what a debt exposes
   (instalment fields, computed balance, opening date, archived state); no bill rows or
   schedule stored; balance at zero / positive is not a stop condition.
7. **Debts submenu UI** — own "Debts" submenu (#32 may still propose merging); pages under
   `/orgs/:orgId/bank/debts…` mirroring `regular.md#accounts-submenu-ui`:
   - List `/orgs/:orgId/bank/debts` — columns, no grand total, sorted by name, no pagination,
     *Show archived*, **New debt**, empty state "No debts yet".
   - Detail `/orgs/:orgId/bank/debts/:accountId` — as regular detail plus the debt info block
     and the shortcuts above the ledger.
   - Create / Edit `/new`, `/:accountId/edit` — Creditor / Loan date / Amount owed labels;
     amount owed typed positive and stored negated (both ways), API stays signed
     `opening_balance`; debt fields with conditional interest period and due month; `type`
     hidden, always `debt`.
8. **Routes, permissions and caching** — reuse the generic account routes of
   `regular.md#routes-and-permissions`, no `/debts.json`. Table of the per-route changes
   (GET list with `type=debt`, POST accepting `type: "debt"` + optional `debt` object, GET
   detail with `debt`, PATCH with partial `debt` merge / `type` immutable / archived only
   `name`, DELETE / archive / unarchive unchanged, transactions / settings unchanged). The
   `debt` object fields in `snake_case` (`interest_rate` and `instalment_amount` as decimal
   strings). Sub-sections **Validation** (debt object on non-debt → 400; rate / period
   together; `due_month` vs frequency; ranges, `instalment_amount` within the #29 amount
   bound, `interest_rate` 0–100 max 4 decimals) and **Permissions and caching** (as #29:
   404 never 403, all members can do everything, whitelisted bodies, GET `user-scoped` with
   `X-Skip-Cache`, writes `never`, nothing in Navi).
9. **Data sensitivity & ownership** — as #29; financial but not credentials, bodies never
   logged, organization-owned.
10. **Owning module** — `bank`, no new module; table `bank_debt_details` (`account_id` PK + FK
    to `bank_accounts` `ON DELETE CASCADE`, no own `organization_id`); only `auth` via
    `@OrgScoped()`; implementation hint (debt-details part called by the generic account
    service, no separate controller). Sub-sections **Backward compatibility** (additive; only
    change: `POST /accounts.json` with `type: debt` no longer 400) and **Memory footprint**.
11. **Edge cases** — the ten numbered cases of the issue (cross-type name uniqueness 409,
    frequency switching, clearing with `null`, always a details row, cascade delete + #29
    409 rule, archived read-only with shortcuts hidden, wrong-type deep-link redirects,
    instalment larger than owed allowed, `due_day` 29–31 stored as given / clamped by #33,
    interest rate 0 valid but needs a period).
12. **Open questions** — resolve the skeleton's four: shared submenu → own "Debts" submenu
    (#32 may propose merging); bills → decided by #33 in `../bills.md`, with the exposed
    fields listed; fields → specified; routes → specified. Keep them as checked items or
    move them into Decisions; leave no unchecked debt-side question.
13. **Reference** — GitHub web URLs only: Epic #26, skeleton #27, owner #30, #29 and its
    `regular.md` / `transactions.md` blob URLs, #33 / #32, organizations spec, caching
    architecture, spec lifecycle.
14. **Required tests** — **Backend** and **Frontend** lists covering: fields and validation
    (every 400 rule and range); `debt` object present on list / detail / create / PATCH,
    partial merge, nulls clear; `bank_debt_details` row created even without a `debt` object;
    signed `opening_balance` accepted in any sign, overpayment allowed; archived debt
    read-only (only `name`); cascade delete of the details row and #29's 409 with
    transactions; cross-type name clash 409; `type=debt` list returns debts only, `regular`
    list excludes them; 404-never-403 and cache classes; frontend list columns / no total /
    empty state / *Show archived*, detail info block, Add payment / Add interest prefills
    (instalment suggested) and hidden when archived, amount-owed negation both ways,
    conditional interest period / due month fields, wrong-type redirects both ways, escaped
    user input.

## Files to Change
- `docs/agents/specs/banking/accounts/debt.md` — full rewrite with the agreed decisions.
