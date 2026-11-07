# Plan: Enhance the banking specs: bills and the calendar

Issue: [33-enhance-the-banking-specs-bills-and-the-calendar.md](../../issues/33-enhance-the-banking-specs-bills-and-the-calendar.md)

## Overview

Documentation only. Turn the #27 skeletons `docs/agents/specs/banking/bills.md` and
`docs/agents/specs/banking/ui/calendar.md` into full specs, using every decision recorded in the
issue's **Solution** section. Then add one-line pointers in the three account specs that defer to
#33, and update the banking `README.md`: index entries, the #33 sub-issue map row, "includes bills"
notes on existing Future epics, and seven new Future epics. No code, migration or test changes.

## Context

- Part of Epic #26 (Bank module). The specs are written against the realigned / finished specs of
  #41, #29, #30 and #32.
- Spec conventions (`docs/agents/specs.md`): one concern per file, decisions not code, and every
  file ends with a **Reference** section (GitHub web URLs only, never local paths) and a
  **Required tests** section.
- Shape to mirror: the finished account specs (`accounts/debt.md`, `accounts/provider-expense.md`)
  use `## Summary`, `## Scope`, topic sections, `## Routes and permissions` (with `### Validation`,
  `### Permissions and caching`), `## Data sensitivity & ownership`, `## Owning module`
  (`### Backward compatibility`, `### Memory footprint`), `## Edge cases`, `## Resolved questions`,
  `## Reference`, `## Required tests`.
- Hybrid bill model: recurring occurrences are **derived** at render time from debt /
  provider-expense accounts (never stored); one-off bills are a small `bank_bills` entity that
  always references a provider-expense account; payments and skips live in `bank_bill_payments`,
  keyed by the **nominal** due date.
- `bills.md` is the single source of truth for the new `billsFrom`, `showInCalendar` and default
  `payingAccountId` columns on `bank_debt_details` / `bank_provider_expense_details`. The account
  specs get pointers only, not field-table rewrites.

## Steps

- [01 — Write the bills spec](plan/01-write-bills-spec.md)
- [02 — Write the Calendar UI spec](plan/02-write-calendar-ui-spec.md)
- [03 — Add pointers in the account specs](plan/03-add-account-spec-pointers.md)
- [04 — Update the banking README](plan/04-update-banking-readme.md)

## Notes

- **No specialist agent has work.** Every changed file is under `docs/agents/`, which the
  architect owns. The architect is the coordinator and is excluded from the agent split, so this
  is a single un-owned plan.
- No CI job checks `docs/`. Verify by hand: relative links resolve, the anchors used by pointers
  (`bills.md#...`) exist, Reference sections use only GitHub URLs, and no skeleton
  `## Open questions` item is left unchecked.
- `ui/menu.md` already marks the Calendar row as **Decided** for #33 and needs no change.
  `accounts/transactions.md` mentions #33 only in passing ("What's coming is covered by bills"),
  and the issue does not ask to change it, so leave it alone. The new *Projected balance* epic
  links to it instead.
- Pick stable heading names in `bills.md` before writing the pointers in step 03, because the
  pointers link to its anchors (suggested: `#schedule-fields-on-source-accounts`,
  `#recurrence-model`, `#paying-a-bill`, `#owning-module`).
- Product sign-off is already in the issue. `product.md` needs no change (bills are already part
  of `bank`'s planned purpose).
