# Plan: Split provider — fold specs into permanent docs

Issue: [126-split-provider-fold-specs-into-permanent-docs.md](../../issues/126-split-provider-fold-specs-into-permanent-docs.md)

## Overview

Last sub-issue of epic [#119](https://github.com/darthjee/ward/issues/119). Move the lasting
content of `docs/agents/specs/split-provider/` into the permanent bank docs. Open the two
missing follow-up epics, update or comment on the existing epics that depend on the provider
model, then delete the spec folder and move its entry to *Completed specs*. The work touches
docs and GitHub issues only. There are no code changes, so no specialist agent has work. The
`architect` agent owns every step.

## Context

- The spec folder (`README.md`, `model.md`, `migration.md`, `security.md`,
  `api/provider-bills.md`, `api/payments.md`, `ui/provider-bills.md`, `ui/calendar.md`) is now
  the only full description of provider bills. #121–#125 and #131–#133 have all shipped.
- The permanent docs were patched piecemeal during the epic and still have stale wording and
  short "see `specs/split-provider/...`" stubs:
  - `modules/bank/bills.md` still says "Recurring bills are derived, never stored" and "No
    standalone recurring bills … Decided against, not deferred". It also ends with
    `## Provider bills API (#122)` / `## Contract step (#125)` stubs.
  - `modules/bank/provider-expense.md` points at `specs/split-provider/model.md` and keeps a
    "Transition rule (#122) — removed in #125" section.
  - `modules/bank/ui.md` Providers section still describes "expected amount with its
    frequency" and schedule fields on the provider create / edit form. Its Add / edit bill
    section describes only the old one-off form.
  - `backend/routes/bank.md` lists seven controllers, but there are nine
    (`ProviderBillsController` and `ProviderBillPaymentsController` were added). It still
    names table `bank_bills`, and it links to the spec for `bills_summary`, the per-bill
    payment routes and the provider-bills routes.
  - `product.md`: the `bank` bullet still says "bills are derived from debt / provider-expense
    schedules".
  - Outside the issue's explicit list, these also mention `bank_bills` / `Bill` and need the
    same fold: `modules/bank.md` (entity table, controller list, ownership contract, index
    row) and `architecture/backend.md` (table row for `bank_bills`).
- Lifecycle rules: [specs.md](../../specs.md) § Lifecycle. Links in the GitHub issue bodies use
  web URLs. Links inside `docs/agents/` keep the existing relative-link convention of each page.
  The spec folder is deleted, so no permanent doc may link into it afterwards.

## Steps

- [01 — Create the follow-up epics](plan/01-create-follow-up-epics.md)
- [02 — Fold into `modules/bank/bills.md` and `modules/bank.md`](plan/02-fold-bills-and-bank-hub.md)
- [03 — Fold into `modules/bank/provider-expense.md`](plan/03-fold-provider-expense.md)
- [04 — Fold into `modules/bank/ui.md`](plan/04-fold-ui.md)
- [05 — Fold into `backend/routes/bank.md` and `architecture/backend.md`](plan/05-fold-routes.md)
- [06 — Update `product.md`](plan/06-update-product.md)
- [07 — Update and re-read the existing epics](plan/07-update-existing-epics.md)
- [08 — Delete the spec folder and close the lifecycle](plan/08-delete-spec-and-close-lifecycle.md)

## CI Checks

No CI job covers `docs/agents/`, so this plan has nothing to run in CI. Check locally that no
link points into the deleted folder:
`grep -rn "specs/split-provider" docs/ AGENTS.md README.md` should return only
`docs/agents/issues/` and `docs/agents/plans/`.

## Notes

- **Order matters.** Step 01 must run first: its epic URLs go into steps 02–04 and 08.
- **Drop, don't fold:**
  - `migration.md` (expand / contract history, which stays in git). Keep only the facts that
    still describe today's schema. Example: payments backfilled for unscheduled providers sit
    on hidden recurring bills (`show_in_calendar = false`).
  - The README's *Sub-issue → file map*, *Delivery* and *Testing* tables.
  - Every per-file *Required tests* section.
  - Transition-only wording such as aliases, `PROVIDER_HAS_MULTIPLE_BILLS`, the
    `'provider'` `OccurrenceKind` and "accepts both values". Mention it at most once, as
    history ("removed in #125").
- **Spec items to verify against the code before folding:** a reviewer may check facts against
  `backend/src/bank/`, and the spec contradicts itself in places. Where the spec is ambiguous,
  read the code (read-only) and record what shipped:
  - `api/provider-bills.md` says an archived provider's bill answers `404` on `GET`, but
    `security.md` says reads pass `allowArchived`.
  - Whether the `bills.json` routes and `bills/:id/payment.json` still exist.
  - The cap value.
  - The response shape of `paying_account` (raw id or `{ id, name }`) on the provider-bills
    routes.
- **The `## Differences from the original spec` sections** in the bank pages describe the
  original banking spec (#26). Leave the existing entries alone. Add entries only where
  split-provider shipped something different from its own spec.
- `gh` is needed for steps 01 and 07. If the `Idea` label does not exist on the repo, stop and
  report it. Do not create labels silently.
- Never put the user's personal data in issue bodies. Seed the bodies only from the spec text.
