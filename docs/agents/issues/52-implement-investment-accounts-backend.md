# Issue: Implement investment accounts — backend

## Description

Add **investment** accounts to the `bank` backend module.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

### Specs

- `docs/agents/specs/banking/accounts/investment.md` (all of it, including *Required tests*)

### Scope

- `bank_investment_details` (one-to-one with `bank_accounts`, `account_id` PK + FK `ON DELETE CASCADE`; inherits the owner through its account) and its migration.
- An investment `AccountTypeHandler`, registered next to the regular and debt handlers (`backend/src/bank/account-types/`), as #50 did for debts. The generic `AccountService` keeps talking only to the registry.
- `POST/PATCH /accounts.json` accept `type: "investment"` and the `investment` object (partial merge on PATCH, `type` immutable). `GET /accounts.json?type=investment` lists them, and the detail includes the `investment` object.
- `opening_balance` is forced to `0` on investment accounts: a non-zero value is a `400` on create and on PATCH. This is an account-level rule, not a nested-object one, so the handler contract may need a hook for it. The plan decides the shape.
- Field validation, ledger / balance rules and edge cases exactly as the spec defines them.

### Decisions on points the spec leaves open

- **PATCH paired-field rule uses the merged result.** `yield_rate` ↔ `yield_period` is checked on the stored details with the request merged on top, not on the request body alone, as #50 does for debts.
  - Example: PATCH `{ investment: { yield_rate: "3" } }` is accepted when a period is already stored.
  - Example: PATCH `{ investment: { yield_period: null } }` is rejected (`400`) while a rate is stored.
  - Clearing the rate still means sending both as `null` (edge case 10).
- **`maturity_date` range.** Any real `YYYY-MM-DD` calendar date, past or future. The "never after UTC today + 1 day" rule for ledger dates does not apply to it. An invalid date (e.g. `2026-02-30`) → `400`.
- **`liquidity_days` range.** An integer from `0` to `2147483647` (the INT column's range), the same bound #50 uses for `instalment_count`.
- **Response formatting.** `yield_rate` is returned without trailing zeros, like debt's `interest_rate`.
- **Archived investment.** Any `investment` field → `409 ACCOUNT_ARCHIVED`. A field that fails the format checks is still a `400`, because the validation pipe runs first (same as debts).
- **Docs.** Record these decisions in `investment.md`. Update `docs/agents/backend/routes/bank.md` with `type=investment`, the `investment` object, the opening-balance rule and their validation errors. Update `regular.md` and `debt.md` where they list the types that have a handler.

### Depends on

- #48 (bank module, regular accounts and transactions — backend), merged.
- #50 (debt accounts — backend; the account-type handler registry), merged.

### Acceptance criteria

- The backend *Required tests* of `investment.md` are covered by Jest specs, and they pass.
- The existing regular and debt specs still pass.
- The `security` and `data-access` reviews raise no unresolved violations.
