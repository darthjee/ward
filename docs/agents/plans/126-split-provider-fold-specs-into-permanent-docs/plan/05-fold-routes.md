# Fold into `backend/routes/bank.md` and `architecture/backend.md`

Before editing, read (read-only) `backend/src/bank/provider-bills.controller.ts`,
`provider-bill-payments.controller.ts`, `bills.controller.ts`, `bill-payments.controller.ts`,
`provider-bill-response.ts` and `occurrence-response.ts`. Write the tables from what shipped,
not only from the spec.

**`backend/routes/bank.md`**

- **Intro:** nine controllers, adding `ProviderBillsController` and
  `ProviderBillPaymentsController`, plus their services (`ProviderBillService`,
  `ProviderBillPaymentService`, `ProviderBillResolver`).
- **`bills_summary` bullet:** inline the full rules from `api/provider-bills.md`:
  - shape `{ count, monthly, yearly }`;
  - `count` covers all bills, and the sums cover recurring bills by `charge_frequency`;
  - never `null`, zero at the currency's exponent;
  - list only;
  - one grouped query;
  - cache covered by owner invalidation.

  Drop the spec link.
- **`## Bills and calendar`:**
  - Table `bank_provider_bills` (not `bank_bills`).
  - Replace the spec link in the account-level paragraph with an anchor to the new section
    below.
  - Rewrite the envelope example with `source_bill` and document `OccurrenceKind`
    (`debt | provider_bill | bill`). Mention once that `provider` was renamed in #125.
- **Replace `## Provider bills (#122)`** with a full `## Provider bills` section:
  - Route table with method, route, body, success, errors and cache class:
    - `GET` / `POST <base>/accounts/:accountId/provider-bills.json?kind=&page=`;
    - `GET` / `PATCH` / `DELETE <base>/provider-bills/:id.json`;
    - `GET <base>/provider-bills/:id/bill-payments.json?page=`;
    - `POST` / `DELETE <base>/provider-bills/:id/occurrences/:dueDate/payment.json`.
  - Body and response fields.
  - List ordering and pagination (50, recurring by description, then one-offs by newest
    `due_date`; unknown `kind` → empty list).
  - The error-code table.
  - The `:dueDate` rules.
- **Removed routes subsection:** list once what #125 removed and what it now answers:
  - the account-level provider aliases for pay / undo / history (now the uniform `404` for
    providers);
  - the provider schedule keys on `provider_expense` (now `400`);
  - `409 PROVIDER_HAS_MULTIPLE_BILLS`.

  Also list the routes that remain, but only for one-offs or debts.
- **Caching subsection:**
  - GETs `user-scoped` (`X-Cache-Allow`).
  - Writes `never` (`X-Skip-Cache`, `@CachePolicy(CacheClass.Never)`) with
    `InvalidatesOwner()` → `/bank` or `/orgs/:id/bank`, which covers `accounts.json`,
    calendar and overdue.
  - Navi warms none of them.
  - The proxy needs no change.

**`architecture/backend.md`**

- Table row `bank_bills` → `bank_provider_bills`, with `kind`, the recurring column group and
  the virtual `recurring_description` unique key. Add `bank_bill_payments.provider_bill_id`
  if that table has a row.

## Files to Change
- `docs/agents/backend/routes/bank.md` — controllers, `bills_summary` rules, envelope, new Provider bills section with removed routes and caching.
- `docs/agents/architecture/backend.md` — table rows for `bank_provider_bills` / `bank_bill_payments`.
