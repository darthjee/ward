# Fold the bank specs into `modules/bank.md` and `modules/bank/`

Write the permanent bank documentation as a hub plus one file per concern, following the
`modules/auth.md` + `modules/auth/` pattern. The sub-pages open the same way as
`modules/auth/user-approval.md`: a title `# Bank — <Concern>`, a one-paragraph summary, and a
link back to [the Bank module](../bank.md).

## Rules for every page

- Describe **what is built**: the code and `backend/routes/bank.md`. Keep decisions,
  invariants and the reasons behind them. Drop "Required tests", "Sub-issue map",
  "Implementation order" and planning prose ("#56 will…").
- Don't repeat full request and response tables. `backend/routes/bank.md` stays the
  per-endpoint reference, so link its sections instead.
- End each page with a **"Differences from the original spec"** section listing the
  divergences that apply to it (see the [plan Context](../plan.md#divergences-found-spec-vs-implementation)).
  Add a **"Deferred"** list that links the epics created in step 01, for example
  "Reconciliation: #NN".
- Use relative links between permanent docs, and GitHub URLs for issues and PRs.

## Pages

- **`modules/bank.md`** (hub):
  - Purpose and scope: accounts, business expenses for the accountant, bills. `bank` is the
    lazy-tier module and the first domain module.
  - The entities and tables: `bank_accounts`, transactions, `bank_debt_details`,
    `bank_investment_details`, `bank_provider_expense_details`, `bank_bills`,
    `bank_bill_payments`.
  - The **Bank ownership contract**, carried over from the spec README:
    - the owner columns and their check constraint;
    - child records inherit the owner;
    - both route prefixes;
    - name uniqueness is per owner;
    - owner fields never appear in responses;
    - a wrong context answers 404.

    Use the backend paths (`/bank/...`, `/orgs/:orgId/bank/...`) and note that the proxy adds
    `/api`. Link epics 13 and 14 here.
  - The account types (`regular`, `debt`, `investment`, `provider_expense`), and the rule
    that the main list shows regular accounts only.
  - Routes: point at `backend/routes/bank.md`.
  - Cache classes: every route is `user-scoped` and sends `X-Skip-Cache`; writes are `never`.
  - An index of `modules/bank/`.
- **`modules/bank/accounts.md`** (from `accounts/README.md` and `accounts/regular.md`):
  - the common account fields;
  - name uniqueness (case-insensitive and accent-sensitive);
  - archive vs delete;
  - regular accounts.

  Link epic 15 (authorship / audit). Divergences:
  - the account number is masked everywhere except the detail;
  - the `opening_date` default and its limit;
  - idempotent archive and unarchive;
  - `?type=` answers 400 when the type is unknown;
  - there is no `has_transactions` flag;
  - deleting an account cascades its bills and skip-only payment rows.
- **`modules/bank/transactions.md`**:
  - the ledger and the opening anchor;
  - computed balances and future-dated transactions;
  - the `Transaction` entity and `sentToAccountantAt`;
  - currency: integer minor units, one currency per account, aggregates grouped per currency;
  - categories (deferred);
  - settings.

  Link epics 5–10 and 24.
- **`modules/bank/debt.md`**:
  - the debt fields and their sign rules;
  - payment and interest;
  - instalments and bills.

  Link epic 11 (credit cards).
- **`modules/bank/investment.md`**:
  - the ledger as the current value, with the opening anchor at 0;
  - application, withdrawal and yield movements, and Update value;
  - the informational fields;
  - the alternatives that were considered.

  Link epic 12.
- **`modules/bank/provider-expense.md`**:
  - the payable ledger and the provider fields;
  - charges and payments;
  - the accountant hand-off: what counts, the client-side CSV (BOM, CRLF, columns, formula
    prefix), mark sent / unsent, the caps and their order;
  - refunds;
  - charges and bills.

  Link epics 9 (refunds via categories), 16 and 17. Divergence: the mark timestamp is
  truncated to whole seconds.
- **`modules/bank/bills.md`**:
  - the hybrid model: derived occurrences, the one-off `Bill`, and the owning module;
  - the schedule fields (a schedule needs `dueDay`, `bills_from`, `showInCalendar` and a
    non-archived account);
  - recurrence: clamp, weekend shift, nominal vs effective date;
  - the occurrence shape;
  - paying, skipping and undoing: payment rows, atomic ledger writes, the optional charge,
    and the 409 codes;
  - data sensitivity;
  - edge cases.

  Link epics 6, 8, 18–23. Divergences:
  - `paying_account` comes back as an object;
  - 404 for a bill whose provider is archived, on GET, PATCH and DELETE.
- **`modules/bank/ui.md`**:
  - the Bank menu: Accounts, Debts, Investments, Providers and Calendar;
  - per-account submenus: list, detail, create / edit, shortcut presets, archived banner,
    Show / Hide archived;
  - schedule fields on the Debts / Providers forms;
  - Add / edit bill;
  - Bill history;
  - the accountant hand-off page;
  - the Calendar list and month views and their dialogs.

  If #77 isn't merged yet, mark the Calendar as pending #77 (see plan Notes). Record the
  frontend divergences listed in the plan Context. Link epics 21 and 22.

## Files to Change
- `docs/agents/modules/bank.md` — new hub
- `docs/agents/modules/bank/accounts.md` — new
- `docs/agents/modules/bank/transactions.md` — new
- `docs/agents/modules/bank/debt.md` — new
- `docs/agents/modules/bank/investment.md` — new
- `docs/agents/modules/bank/provider-expense.md` — new
- `docs/agents/modules/bank/bills.md` — new
- `docs/agents/modules/bank/ui.md` — new
