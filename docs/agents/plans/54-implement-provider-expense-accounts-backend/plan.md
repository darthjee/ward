# Plan: Implement provider-expense accounts — backend

Issue: [54-implement-provider-expense-accounts-backend.md](../../issues/54-implement-provider-expense-accounts-backend.md)

## Overview

Add the `provider_expense` account type to the `bank` backend module, following the 1:1
details-table pattern of #50 (debt) and #52 (investment): a `bank_provider_expense_details`
table and migration, a nested `provider_expense` DTO, a `ProviderExpenseAccountHandler`
registered in the account-type registry, and Jest / e2e / MySQL integration specs. Charges and
payments use the generic transaction routes unchanged. The accountant hand-off
(`sent_to_accountant_at`, preview, mark sent / unsent) is out of scope (#71).

See [backend.md](backend.md) for the full plan.

## Documentation (architect, same PR)

After the backend work lands, the architect updates:

- `docs/agents/specs/banking/accounts/provider-expense.md` — "(decided in #54)" notes next to
  the rules they refine: `expected_amount` rescale on currency change, paired
  `charge_frequency` ↔ `due_month` rules on the merged state, non-nullable `charge_frequency` /
  `for_accountant`, `provider_tax_id` trimmed / blank → `null` / no format check.
- `docs/agents/specs/banking/accounts/regular.md` — "Type without a handler on create": all four
  types are accepted; only an unknown type → `400`.
- `docs/agents/backend/routes/bank.md` — `provider_expense` in the `type` lists and the
  `CreateAccountDto` table, plus a *Provider-expense object* section shaped like Debt /
  Investment.
- `docs/agents/backend/routes.md` — the "(regular, debt and investment)" wording.
- `docs/agents/architecture/backend.md` — a `bank_provider_expense_details` row in the tables
  list.

## Reviews

- `security` and `data-access` after the backend steps (new accepted body object and response
  fields on existing endpoints).
- `cache` to confirm no Navi change is needed (routes unchanged, all `user-scoped` / `never`).
