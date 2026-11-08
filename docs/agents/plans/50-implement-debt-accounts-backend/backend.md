# Backend Plan: Implement debt accounts — backend

Main plan: [plan.md](plan.md)

## Overview
Debt accounts reuse the generic account routes; debt-specific data travels as a nested
snake_case `debt` object. The backend already has a per-type hook (`AccountTypeHandler` in
`backend/src/bank/account-types/account-type-handler.ts`, resolved by `AccountTypeRegistry`,
with `validateCreate`, `validateUpdate`, `loadDetails`, `saveDetails`, `serialize`), and
`serializeAccount()` already writes `response[account.type] = nested`. Most of the work is a
new `DebtDetails` entity + migration, a `DebtAccountHandler`, a nested DTO, and three targeted
`AccountService` changes (archived-check ordering, currency rescale of `instalment_amount`,
merged-state validation on PATCH).

## Context
- Source of truth: `docs/agents/specs/banking/accounts/debt.md` (including *Required tests*),
  plus `regular.md` and `transactions.md` for the inherited rules.
- Decisions fixed by the issue:
  - **Currency change** (only before any transaction): `instalment_amount` keeps its decimal
    value and is rescaled to the new exponent exactly like `opening_balance`; unrepresentable
    → `400` (e.g. `12.50` BRL → JPY).
  - **PATCH paired rules use the merged result**: `interest_rate` ↔ `interest_period` and
    `instalment_frequency: yearly` ↔ `due_month` are checked on stored state with the request
    merged on top. `yearly` → `monthly` still clears `due_month` automatically.
- Out of scope: `billsFrom`, `showInCalendar`, `payingAccountId` (added by #56), frontend (separate
  sub-issue), linked transfers, interest automation.

### API contract (`debt` object, snake_case)

| Field | Request | Response |
|---|---|---|
| `interest_rate` | decimal string, 0–100, ≤ 4 decimals, or `null` | decimal string (e.g. `"1.99"`) or `null` |
| `interest_period` | `"monthly"` \| `"yearly"` \| `null`; set iff rate set (merged) | same |
| `instalment_amount` | decimal string in the account currency, > 0, ≤ 10¹³ minor units, or `null` | decimal string in currency exponent or `null` |
| `instalment_frequency` | `"monthly"` \| `"yearly"` (not nullable; default `monthly`) | same |
| `due_day` | int 1–31 or `null` | same |
| `due_month` | int 1–12 or `null`; required iff frequency `yearly` (merged) | same |
| `instalment_count` | int ≥ 1 or `null` | same |

Present on list rows, detail, create / PATCH / archive / unarchive responses of debt accounts
only; absent on regular accounts.

## Steps

- [01 — Add the `DebtDetails` entity and migration](backend/01-entity-and-migration.md)
- [02 — Add the nested `debt` DTO](backend/02-debt-dto.md)
- [03 — Implement `DebtAccountHandler`](backend/03-debt-handler.md)
- [04 — Adjust `AccountService` for debts](backend/04-account-service.md)
- [05 — Tests covering the spec's *Required tests*](backend/05-tests.md)
- [06 — Documentation updates](backend/06-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)

## Notes
- Step 06 edits files under `docs/agents/` — that is the **architect's** scope; the backend
  agent should hand it back (or the architect does it after steps 01–05).
- No new endpoint and no cache-class change: routes are the existing generic ones, already
  `user-scoped` / `never`. `cache` should still confirm nothing goes into Navi; `security` and
  `data-access` review is required by the acceptance criteria (new response object, new user
  input).
- Interest-rate serialization: MySQL `DECIMAL(7,4)` returns `"1.9900"`; normalise on output by
  stripping trailing fractional zeros (`"1.99"`, `"0"`, `"100"`) so responses match the spec's
  example. Record this in `debt.md` along with the issue's two decisions.
- `type` immutability and name uniqueness across types are already enforced
  (`type` not on `UpdateAccountDto`; `active_name_key` unique index ignores type) — only tests
  are needed for them.
