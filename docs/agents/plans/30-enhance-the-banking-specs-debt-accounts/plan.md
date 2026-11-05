# Plan: Enhance the banking specs: debt accounts

Issue: [30-enhance-the-banking-specs-debt-accounts.md](../../issues/30-enhance-the-banking-specs-debt-accounts.md)

## Overview

Documentation-only refinement of the banking specs (Epic #26). Turns the
`docs/agents/specs/banking/accounts/debt.md` skeleton written by #27 into the agreed definition
of debt accounts (loans): fields, ledger semantics, payment recording, Debts submenu pages,
routes / validation / permissions / cache class, edge cases, owning module and Required tests.
It also updates the Debt row of `ui/menu.md` and the `README.md` index and Future epics. No
code changes; no specialist agent is involved — `docs/agents/` is owned by the architect.

## Context

- Debt accounts reuse everything #29 specified in `accounts/regular.md` (common fields, name
  uniqueness, archive vs delete, generic account routes and rules) and
  `accounts/transactions.md` (ledger, opening anchor, `Transaction` entity, currency, amounts in
  `BIGINT` minor units, generic transaction routes).
- The issue file's `## Solution` section holds every agreed decision; the plan only places them
  into the spec files, following the conventions of `docs/agents/specs.md` (a **Reference**
  section with GitHub web URLs only, and a **Required tests** section).
- Out of scope (stays deferred, recorded where relevant): linked transfers, bill generation
  (#33), interest automation, credit cards (new Future epic), currency conversion, categories.

## Steps

- [01 — Rewrite accounts/debt.md](plan/01-rewrite-debt-spec.md)
- [02 — Update the Debt row of ui/menu.md](plan/02-update-menu-row.md)
- [03 — Update the banking README index and Future epics](plan/03-update-readme.md)

## Notes

- **File ownership in the shared specs** — `ui/menu.md` is a shared table: edit only the Debt
  row and the matching open question. Do not touch `bills.md` (#33),
  `accounts/provider-expense.md` (#32) or the Provider-expense row of `ui/menu.md` (#32), even
  though they carry the mirror of the shared-submenu / bills questions.
- **`accounts/regular.md` still says** `POST /accounts.json` answers 400 for any `type` other
  than `regular` "until the other type specs exist". That wording already anticipates other
  types, so it is left untouched (owned by #29); `debt.md` states explicitly that `type: debt`
  is now accepted (the one backward-compatibility change). The fold sub-issue of #26
  reconciles both files.
- **Cross-type name uniqueness** is already the #29 rule ("among active accounts of any
  type"); `debt.md` restates it as a debt edge case and a Required test rather than changing
  `regular.md`.
- No CI job validates Markdown; verification is a manual read-through of links and anchors
  (`../ui/menu.md`, `regular.md#...`, `transactions.md#...`, `../README.md#future-epics`).
