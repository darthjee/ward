# Plan: Enhance the banking specs: regular accounts and transactions

Issue: [29-enhance-the-banking-specs-regular-accounts-and-transactions.md](../../issues/29-enhance-the-banking-specs-regular-accounts-and-transactions.md)

## Overview

Documentation-only change. Turn the `accounts/regular.md` and `accounts/transactions.md`
skeletons (written by #27) into agreed definitions, following the decisions recorded in the
issue's `## Solution`. Then update the **Accounts** row of `ui/menu.md` and the banking
`README.md` (index entries and new Future epics). No code, no other spec file.

The whole change is inside `docs/agents/`, the architect's own scope — no specialist agent has
work.

## Context

- Part of Epic #26 (`bank` module, lazy tier). Spec lifecycle: `docs/agents/specs.md`. Every
  spec file must keep a **Reference** section (GitHub web URLs only, never local paths) and a
  **Required tests** section, next to the rules it verifies.
- Depends on #27 (skeletons exist) and builds on #28 (`docs/agents/specs/auth/organizations.md`:
  `@OrgScoped()`, data-ownership rule, 404-never-403, roles stored but not enforced,
  `snake_case` responses, other users' ids never exposed).
- #30–#32 reuse the common fields and generic account routes defined here; they decide their
  own type-specific fields and whether they use the ledger. #33 owns bills/calendar.
- The issue's `## Solution` is the source of truth; each spec section below must match it
  exactly (field tables, limits, routes, cache classes, edge cases). Write it as decisions, not
  code; name code only to point at a convention (`@OrgScoped()`,
  `LazyModuleLoaderService#loadOnFirstRequest()`, whitelist `ValidationPipe`).

## Steps

- [01 — Write accounts/regular.md](plan/01-write-regular-accounts-spec.md)
- [02 — Write accounts/transactions.md](plan/02-write-transactions-spec.md)
- [03 — Update ui/menu.md and the banking README](plan/03-update-menu-and-readme.md)

## Notes

- Replace the skeleton banner ("Skeleton written by #27: it records only what is already
  decided") with an "Owned by #29" banner only; remove every `## Open questions` checkbox that
  this issue resolves. Questions belonging to #30–#32 are not added here.
- The cross-cutting sections of the issue (*Data sensitivity & ownership*, *Performance &
  security*, *Owning module*, *Edge cases*, *Backward compatibility*, *Memory footprint*,
  *Alternatives considered*) apply to both files. Put each rule in the file that owns the
  concern (account rules in `regular.md`, ledger/balance/transaction rules in
  `transactions.md`) and cross-link rather than duplicate; *Owning module*, *Data
  sensitivity* and *Memory footprint* go in `regular.md` with a link from `transactions.md`.
- Rejected alternatives are written next to the decision they relate to (as the issue says),
  not in a separate section — or in a short `## Alternatives considered` list per file, each
  item linking to its decision.
- Do not edit `accounts/README.md`, `debt.md`, `investment.md`, `provider-expense.md`,
  `bills.md`, `ui/calendar.md`, `specs.md`, `product.md` or create `modules/bank.md` (fold
  issue). In `ui/menu.md` only the Accounts row changes.
- Cache classes listed in the routes tables (`user-scoped` for GETs, `never` for writes) mean
  no Navi warm-up entry; nothing to add to `navi/` (doc-only issue anyway).
- Removal of this plan folder happens at the end of the fix, per the repo's usual flow.
