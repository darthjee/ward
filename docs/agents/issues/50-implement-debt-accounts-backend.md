# Issue: Implement debt accounts — backend

## Description

Add **debt** accounts to the `bank` backend module.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

### Specs

- `docs/agents/specs/banking/accounts/debt.md` (all of it, including *Required tests*)

### Scope

- `bank_debt_details` (one-to-one with `bank_accounts`; inherits the owner through its account) and its migration.
- `POST/PATCH /accounts.json` accept `type: "debt"` and the `debt` object (partial merge on PATCH, `type` immutable). `GET /accounts.json?type=debt` lists them, and the detail includes the `debt` object.
- Field validation, ledger / balance rules and edge cases exactly as the spec defines them.
- Bills-related fields (`billsFrom`, `showInCalendar`, `payingAccountId`) are **not** added here: #56 (bills and the calendar — backend) adds them in its own migration (see `bills.md` § Backward compatibility).

### Decisions on points the spec leaves open

- **Currency change and `instalment_amount`.** When a debt's `currency` changes (only allowed before any transaction, as in `regular.md`), `instalment_amount` is converted the same way as `opening_balance`: its decimal value is kept and rescaled to the new currency's exponent. When it can't be represented, the answer is `400` (e.g. `12.50` BRL → JPY).
- **PATCH paired-field rules use the merged result.** `interest_rate` ↔ `interest_period` and `instalment_frequency: yearly` ↔ `due_month` are checked on the stored state with the request merged on top, not on the request body alone.
  - Example: PATCH `{ debt: { interest_rate: "2.5" } }` is accepted when a period is already stored.
  - Example: PATCH `{ debt: { interest_period: null } }` is rejected (`400`) while a rate is stored.
  - `yearly` → `monthly` still clears `due_month` automatically (edge case 2).
- **Docs.** Record both decisions in `debt.md`. Update `docs/agents/backend/routes/bank.md` with `type=debt`, the `debt` object and its validation errors. Reconcile `regular.md`'s "until the other type specs exist" rule, so it no longer says `type: "debt"` → `400`.

### Depends on

- #48 (bank module, regular accounts and transactions — backend).

### Acceptance criteria

- The backend *Required tests* of `debt.md` are covered by Jest specs, and they pass.
- The `security` and `data-access` reviews raise no unresolved violations.
