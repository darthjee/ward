# Plan: Enhance the banking specs: provider-expense accounts

Issue: [32-enhance-the-banking-specs-provider-expense-accounts.md](../../issues/32-enhance-the-banking-specs-provider-expense-accounts.md)

## Overview

Documentation-only change under `docs/agents/specs/banking/`. Replace the #27 stub
`accounts/provider-expense.md` with a full spec (model, fields, accountant hand-off, charges and
bills, Providers submenu pages, routes / permissions / caching, data sensitivity, edge cases,
Reference, Required tests), then apply the small, scoped edits the issue lists to
`accounts/transactions.md`, `ui/menu.md` and the banking `README.md`. No code, no specialist
agent has work: the architect owns `docs/agents/`.

## Context

- Part of Epic #26 (Bank module); written against the specs realigned by #41 (PR #43, landed).
- Every decision is already taken in the issue's **Solution** section — the plan transcribes
  them; it does not reopen any of them.
- Shape to follow: `accounts/debt.md` (#30) and `accounts/investment.md` (#31) — header
  blockquote, `## Summary`, `## Scope`, ledger section, `## Fields`, recording section, bills
  section, submenu UI with `### List` / `### Detail` / `### Create / Edit`, `## Routes and
  permissions` (+ `### Validation`, `### Permissions and caching`), `## Data sensitivity &
  ownership`, `## Owning module` (+ backward compatibility, memory footprint), `## Edge cases`,
  `## Resolved questions`, `## Reference`, `## Required tests`.
- May run in parallel with #33: `bills.md` and `ui/calendar.md` are **not** touched.

## Steps

- [01 — Write the full provider-expense spec](plan/01-write-provider-expense-spec.md)
- [02 — Minimal additions to transactions.md](plan/02-update-transactions.md)
- [03 — Providers row and open question in ui/menu.md](plan/03-update-menu.md)
- [04 — Banking README: index, decisions, sub-issue map, Future epics](plan/04-update-banking-readme.md)

## Notes

- No CI job covers `docs/`; verification is a manual pass: every relative link and anchor
  added (e.g. `regular.md#rules`, `regular.md#data-sensitivity--ownership`,
  `transactions.md#routes`, `../README.md#future-epics`, `#business-expenses-for-the-accountant`)
  resolves, and `grep -n "#32" docs/agents/specs/banking` shows no stale "decided by #32" /
  "open" wording left in the files in scope.
- Link paths in the issue use `../specs/banking/accounts/regular.md` (relative to the issues
  folder); inside `provider-expense.md` they must be rewritten as `regular.md#…`.
- Known stale wording **outside** scope, left untouched on purpose (the issue excludes the
  type-specific files of #29–#31 and #33's files): `accounts/debt.md` "Debts submenu UI" says
  "#32 may still propose merging"; `bills.md` lists "Whether bills are standalone or generated
  by debt / provider-expense accounts" (that stays #33's question). Mention the debt.md line in
  the PR description as a follow-up candidate for the fold issue.
- `accounts/README.md`: no change expected (provider-expense accounts are already "seen in
  their own place"). Its line 20 says "Debt and provider-expense accounts" are not in the main
  list — still true; leave it.
- `product.md` and `.claude/agents/data-access.md` are updated at fold time, not here.
- Consult `product-owner` (read-only) during implementation if any wording in the spec seems to
  conflict with `product.md`; the issue already lists it as a consultee.
