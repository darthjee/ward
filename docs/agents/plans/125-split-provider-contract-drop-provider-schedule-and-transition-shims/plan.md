# Plan: Split provider: contract, drop provider schedule and transition shims

Issue: [125-split-provider-contract-drop-provider-schedule-and-transition-shims.md](../../issues/125-split-provider-contract-drop-provider-schedule-and-transition-shims.md)

## Overview

This is the contract step of the split-provider epic (#119). Provider bills become the only
source of a provider's schedule:

- A migration drops the seven schedule columns from `bank_provider_expense_details`. Its `down`
  is lossy.
- The provider-expense DTOs and response lose the schedule fields. Sending one is a strict `400`.
- The write-through, the `409 PROVIDER_HAS_MULTIPLE_BILLS` and the account-level compatibility
  aliases for providers are removed.
- `OccurrenceKind` `provider` is renamed to `provider_bill`.
- The frontend drops its three remaining dependencies: the client allowlist, the **Add charge**
  prefill and `CHARGE_KINDS`.

Backend and frontend ship in **one PR**. That PR is merged only after #124, #131, #132 and #133
are **deployed**.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

**Provider-expense account response.** `provider_expense` is exactly:

```json
{ "for_accountant": true, "provider_tax_id": "12.345.678/0001-90" }
```

- `provider_tax_id` is `string | null`.
- The seven schedule keys (`expected_amount`, `charge_frequency`, `due_day`, `due_month`,
  `bills_from`, `show_in_calendar`, `paying_account_id`) are **absent**, not `null`.

**Provider-expense create / PATCH body.** The nested `provider_expense` accepts only
`for_accountant` and `provider_tax_id`. Any other key there, including a schedule key, is a `400`
validation error under `@StrictBody()`.

**Provider bill list (unchanged, now used by the frontend with a filter):**

- `GET <base>/bank/accounts/:accountId/provider-bills.json?kind=recurring&page=1` returns
  `{ provider_bills: ProviderBill[], pagination: { page, per_page, total_pages, total_count } }`.
- `ProviderBill.expected_amount` is a formatted string or `null`.
- Provider bills have **no archived flag**. "Non-archived recurring" in the issue resolves to
  "`kind = 'recurring'`", because an archived provider account already hides the shortcut bar.

**Single-bill rule.** Both the migration's `down` backfill and the frontend **Add charge**
prefill use the same rule:

- Count the provider's bills with `kind = 'recurring'`, ignoring one-off bills.
- Exactly one such bill: take its values.
- Zero or several: `NULL` in the migration, an empty amount in the frontend.

**Calendar occurrences.** `kind` is `'debt' | 'provider_bill' | 'bill'` and is never
`'provider'`. Recurring provider-bill occurrences carry `kind: 'provider_bill'` and still carry
`source_bill`. The frontend `CHARGE_KINDS` becomes `['provider_bill', 'bill']`.

**Account-level bill routes for a `provider_expense` account.** These routes answer the same
uniform `404` as an unknown or foreign account, with the same status and the same body:

- `GET <base>/bank/accounts/:id/bill-payments.json`
- `POST <base>/bank/accounts/:id/occurrences/:dueDate/payment.json`
- `DELETE <base>/bank/accounts/:id/occurrences/:dueDate/payment.json`

Debt accounts are unchanged. The frontend already uses only per-bill routes for providers.

**Error codes.** `PROVIDER_HAS_MULTIPLE_BILLS` no longer exists. The frontend never mapped it.

## Review and documentation (outside the agent plans)

- `security` and `data-access` review the following. No dedicated security review beyond the
  usual PR checks is required.
  - the removed fields and routes;
  - the uniform `404` for providers on the account-level routes;
  - the strict nested `400`.
- `cache` confirms nothing changes in Navi: no bank route is warmed, and the routes keep their
  cache classes. The proxy cache is reset on deploy, since migrations send no invalidation header.
- `architect` updates the docs in the same PR:
  - `docs/agents/specs/split-provider/migration.md`:
    - the "Contract migration (#125)" and "Rollback" sections: the backfill counts recurring
      bills only (provider bills have no archived flag), and `down` is re-runnable;
    - transition rules marked as removed.
  - `docs/agents/specs/split-provider/api/payments.md` and `model.md`: the aliases are gone, and
    the `OccurrenceKind` is `provider_bill`.
  - `docs/agents/modules/bank/provider-expense.md`, `docs/agents/modules/bank/bills.md`,
    `docs/agents/backend/routes/bank.md` and `docs/agents/architecture/backend.md`: drop the
    provider schedule fields, the write-through, the `409` and the aliases.
  - Folding the specs into permanent docs stays out of scope (#126).
- PR description:
  - the rollback order: run the migration's `down` **first**, then revert the code;
  - the maintainer's production-dump dry-run results, as aggregate counts only;
  - the deploy gate (#124, #131, #132 and #133 deployed).
