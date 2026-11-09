# Backend Plan: Implement provider-expense accounts — backend

Main plan: [plan.md](plan.md)

## Overview

Add `type: "provider_expense"` to the generic account routes with a nested `provider_expense`
object stored 1:1 in `bank_provider_expense_details`, mirroring #50 (debt) and #52
(investment). The handler interface and `account.service.ts` are unchanged: the registry already
routes `dto.provider_expense` / `response.provider_expense` by `handler.type`, and
`assertNoForeignNested` rejects the object on other types once the handler is registered.

## Context

Spec: `docs/agents/specs/banking/accounts/provider-expense.md` (*Ledger and balance*, *Fields*
except `sentToAccountantAt`, *Recording charges and payments*, *Routes and permissions →
Accounts*, *Validation* (accounts), *Edge cases* 12–14 and the closing paragraph, *Required
tests* for Account routes and DB). Issue decisions:

- `provider_tax_id`: free text, at most 32 code points, trimmed, blank → `null`, no format check.
- `expected_amount`: decimal string in the account's currency; > 0, within the 10¹³ minor-unit
  bound and the currency's decimals. A `currency` change on PATCH rescales the stored value
  like `opening_balance` (`400` when not representable), unless the same PATCH sends
  `expected_amount`, which is then validated against the new currency (`null` clears).
- `charge_frequency` (default `monthly`) and `for_accountant` (default `true`) are not
  nullable: `null` → `400`. All other fields accept `null` to clear.
- Paired rule checked on the merged state (stored/defaults + request): `yearly` needs
  `due_month`; `monthly` with a sent non-null `due_month` → `400`; switching to `monthly`
  clears `due_month` automatically. See the issue's table — every row must be covered.
- No object on POST still creates a details row (`for_accountant` `true`,
  `charge_frequency` `monthly`, the rest `null`).

## Shared contracts

Response / request object (snake_case), present only on provider-expense accounts (list rows,
detail, create / update / archive / unarchive responses):

```json
"provider_expense": {
  "for_accountant": true, "provider_tax_id": "12.345.678/0001-90",
  "expected_amount": "200.00", "charge_frequency": "monthly",
  "due_day": 10, "due_month": null
}
```

- `for_accountant`: boolean, never `null`.
- `provider_tax_id`: string ≤ 32 or `null`.
- `expected_amount`: decimal string formatted with `formatAmount(minor, account.currency)` or
  `null`.
- `charge_frequency`: `"monthly"` | `"yearly"`, never `null`.
- `due_day`: int 1–31 or `null`; `due_month`: int 1–12 or `null`.

## Steps

- [01 — Entity and migration](backend/01-entity-and-migration.md)
- [02 — Nested DTO](backend/02-nested-dto.md)
- [03 — Details helpers and handler](backend/03-details-helpers-and-handler.md)
- [04 — Test harness and existing specs](backend/04-test-harness-and-existing-specs.md)
- [05 — Provider-expense e2e spec](backend/05-provider-expense-e2e-spec.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job:
  `backend_integration`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- Optionally `docker-compose run --rm ward_tests yarn build`, and
  `docker-compose run --rm ward_app yarn migration:run` / `migration:revert` against the dev DB.

## Notes

- **Debt code stays untouched.** The issue says "reuse the debt merge helpers where possible"
  but also "regular, debt and investment code is not touched". The paired-rule logic in
  `debt-details.ts` is inline and hard-codes `debt.*` messages and `instalment_frequency`, so it
  is not reusable without refactoring. Decision: copy the pattern into
  `provider-expense-details.ts`, reusing only the already-generic helpers
  (`parseAmountInput`, `convertAmountInput`, `formatAmount`, `RATE_PERIODS`,
  `IsOptionalNonNull`, `MaxCodePoints`, `trimToNull`, `bigintTransformer`). Extracting a shared
  due-schedule helper is a possible follow-up, not part of this issue.
- `account.service.ts` is ~293 lines (300-line limit) — do not add code there.
- Out of scope: `sent_to_accountant_at` and hand-off routes (#71); bills fields (#56);
  frontend (the Accounts `accountTypeGuard` already treats a provider account as not found).
- Edge case 12 (charge differs from `expected_amount`) means no validation of charges against
  it.
- The MySQL "down" chain test in `bank-schema.integration-spec.ts` must gain a step for the new
  migration or `backend_integration` fails (unit jobs do not catch it).
- The architect updates the docs listed in [plan.md](plan.md) after these steps.
