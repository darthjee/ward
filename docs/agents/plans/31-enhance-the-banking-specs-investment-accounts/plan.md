# Plan: Enhance the banking specs: investment accounts

Issue: [31-enhance-the-banking-specs-investment-accounts.md](../../issues/31-enhance-the-banking-specs-investment-accounts.md)

## Overview

Documentation-only refinement of the banking specs (Epic #26). Rewrite the stub
`docs/agents/specs/banking/accounts/investment.md` into an agreed definition, using every decision
in the issue's Solution section. Then update the shared files that mention investment accounts
(`ui/menu.md`, `accounts/README.md`, `specs/banking/README.md`) so none of them still lists
investment placement as open. No code, no tests, no specialist agent work: everything lives in
`docs/agents/`, which the architect owns.

## Context

- #27 wrote the skeleton. #29 (regular accounts and transactions) and #30 (debt accounts) set
  the patterns this issue reuses: the generic account routes, a 1:1 details table
  (`bank_debt_details`), a nested snake_case type object, and a separate submenu with
  shortcuts.
- `docs/agents/specs/banking/accounts/debt.md` is the structural template. Mirror its sections
  (Summary, Scope, Ledger and balance, Fields, Recording movements, submenu UI, Routes and
  permissions with Validation and Permissions and caching, Data sensitivity & ownership, Owning
  module with Backward compatibility and Memory footprint, Edge cases, Resolved questions,
  Reference, Required tests).
- `docs/agents/specs.md` conventions: every spec file ends with **Reference** (GitHub web URLs
  only, never local paths) and **Required tests**. Deferred concerns go into the feature
  README's `## Future epics`, not into GitHub issues.
- `ui/menu.md` uses a shared table where each sub-issue edits only its own row.

## Steps

- [01 — Rewrite accounts/investment.md](plan/01-rewrite-investment-spec.md)
- [02 — Update ui/menu.md and accounts/README.md](plan/02-update-menu-and-accounts-index.md)
- [03 — Update the banking README](plan/03-update-banking-readme.md)

## Notes

- `accounts/README.md` is not in the issue's explicit scope list. However, its "main accounts
  list" bullet says investment placement "is open", and that is exactly what this issue decides.
  Step 02 edits only that bullet, the same way #30 kept the shared decision bullets consistent.
  If a reviewer objects, drop that edit.
- `accounts/transactions.md` (owned by #29) says each type "decides in their own files" whether
  it uses the ledger. That stays true, so it needs no edit. investment.md links to it instead.
- `regular.md` has an "until the other type specs exist" rule: `POST` with an unspecified
  `type` answers 400. investment.md's Backward compatibility section should say that
  `type: investment` stops answering 400 once this is implemented, reconciled by the fold
  sub-issue (same wording as debt.md).
- `docs/agents/` only, so no CI job applies. Check the result by hand: relative links resolve,
  anchors exist (e.g. `#investments-submenu-ui`), and the Reference sections use only GitHub
  URLs.
