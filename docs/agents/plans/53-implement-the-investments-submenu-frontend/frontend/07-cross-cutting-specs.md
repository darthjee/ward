# Cross-cutting specs: deep links, contexts, escaping

Close the remaining frontend *Required tests* of `investment.md` and `menu.md` that span
several pages, then run the full suite and lint.

- **Wrong-type deep links, at page level, in both contexts:**
  - an investment opened under `<ui>/accounts/:id` or `<ui>/debts/:id` → `<ui>/investments/:id`;
  - a regular / debt account opened under `<ui>/investments/:id` → its own path;
  - the same for the `/edit` pages.
  - Add these to `BankInvestmentDetailSpec` / `BankInvestmentFormPagesSpec`, and add the
    investment case to `BankAccountDetailSpec` / `BankDebtDetailSpec`.
- **Investments are absent from the Accounts list.** `BankAccountList` asks for
  `type: 'regular'`. Assert it if no spec does already.
- **Both contexts.** Investments pages render under `/bank/investments...` and
  `/orgs/:orgId/bank/investments...`, with links built from the active context.
- **Switching context** from any investments page lands on the Investments list.
- **Escaping.** Names, institution, notes and descriptions render as text (no
  `dangerouslySetInnerHTML`).
- Run `docker-compose run --rm ward_fe yarn coverage` and `docker-compose run --rm ward_fe yarn lint`.
  The Accounts and Debts specs must stay green.

## Files to Change
- `specs/assets/js/components/resources/bank/investments/**` — the page-level deep-link and context cases
- `specs/assets/js/components/resources/bank/accounts/pages/BankAccountDetailSpec.js` — investment → redirect
- `specs/assets/js/components/resources/bank/debts/pages/BankDebtDetailSpec.js` — investment → redirect
- `specs/assets/js/utils/routing/sectionTargetSpec.js` — the context switch, if not covered in step 03
