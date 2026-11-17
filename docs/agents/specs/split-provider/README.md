# Split provider — Provider bills

Feature spec for epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
This folder is the source of truth for sub-issues [#121](https://github.com/darthjee/ward/issues/121)
to [#126](https://github.com/darthjee/ward/issues/126); see
[Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md) for the lifecycle.

## Overview

Today a `provider_expense` account carries exactly one recurring schedule
(`bank_provider_expense_details`). A provider that bills several services on one tax id (an ISP
with internet, phone and mobile) cannot be modelled. The epic lets a provider hold **N
`ProviderBill` rows**, each `recurring` or `one_off`, in one table `bank_provider_bills` (renamed
from `bank_bills`), with an immutable `kind`. The ledger, balance and accountant hand-off stay
per account.

## Product decision

This **reverses** "No standalone recurring bills … Decided against, not deferred." in
[`modules/bank/bills.md`](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md).
It is not a bill without an account: every bill still belongs to a provider; the change is that a
provider may hold **several recurring bills**. "Recurring bills are derived, never stored"
becomes "recurring schedules are stored on provider bills"; debts are untouched and still derive
from the account. The permanent docs (`bills.md`, `provider-expense.md`, `ui.md`,
`backend/routes/bank.md`, `product.md`) are rewritten at fold time (#126), not now.

| Decision | Choice |
|---|---|
| One table or two | One `bank_provider_bills` with `kind` |
| Discriminator | Explicit, immutable `kind` |
| Where the schedule lives | On the bill, removed from the provider at contract |
| Ledger | Unchanged: one per account, no transaction → bill link |
| Payment identity | `provider_bill_id` (recurring), `bill_id` kept for one-offs |
| `bills.json` | Kept, implicitly `one_off` (see [api/provider-bills.md](api/provider-bills.md)) |
| Default paying account | Per bill |
| `for_accountant` | Stays on the provider |
| Migration shape | Expand / contract across sub-issues |
| `bank_bills` handling | `RENAME TABLE` |

## Scope and out of scope

Out of scope: a per-transaction link to the bill, a combined calendar across owners
([#101](https://github.com/darthjee/ward/issues/101)), converting one-offs to recurring bills,
multiple schedules per debt account, and per-bill archiving.

## Index

- [model.md](model.md) — entity, `kind`, validation matrix, payment keys, cap, indexes
- [migration.md](migration.md) — expand / contract, transition rules, rollback, dry run
- [security.md](security.md) — ownership, data sensitivity, performance and security
- [api/provider-bills.md](api/provider-bills.md) — CRUD routes, error codes, `bills.json`, cache
- [api/payments.md](api/payments.md) — per-bill payments / history, occurrences, cache
- [ui/provider-bills.md](ui/provider-bills.md) — provider detail, add / edit, list, history
- [ui/calendar.md](ui/calendar.md) — calendar label and Pay form

## Sub-issue → file map

| Sub-issue | Reads |
|---|---|
| [#121](https://github.com/darthjee/ward/issues/121) expand migration | `model.md`, `migration.md`, `security.md` |
| [#122](https://github.com/darthjee/ward/issues/122) provider-bills CRUD API | `model.md`, `api/provider-bills.md`, `security.md` |
| [#123](https://github.com/darthjee/ward/issues/123) calendar, payments and history per bill | `model.md`, `api/payments.md`, `migration.md`, `security.md` |
| [#124](https://github.com/darthjee/ward/issues/124) frontend provider bills UI | `api/*.md`, `ui/*.md` |
| [#125](https://github.com/darthjee/ward/issues/125) contract | `migration.md`, `api/payments.md` |
| [#126](https://github.com/darthjee/ward/issues/126) fold specs into permanent docs | all files, § Future epics |

## Delivery

Strictly sequential, each independently deployable: #120 specs → #121 expand migration and
write-through → #122 CRUD API → #123 calendar / payments / history per bill with aliases →
#124 frontend (needs #122 and #123) → #125 contract (only after #124 is deployed) → #126 fold.
(The epic numbers these 1–7; the GitHub numbers are used here.)

## Decided concerns

The four concerns the epic left open are settled:

- **Caching** — in `api/*.md`: GETs `user-scoped`, writes `never` with `InvalidatesOwner()`,
  Navi warms nothing (confirmed, no revision).
- **Data sensitivity and ownership** — in `security.md`: owner-only, no global-admin access, all
  org members full access until #81 (confirmed).
- **Performance and security** — in `security.md`: the epic's decisions confirmed, with the
  additions listed there (supersede the epic where they differ).
- **Testing** — below, plus each file's Required tests. Revision: `bills.json` keeps `amount`
  (see `api/provider-bills.md`), superseding the epic's rename in that payload.

## Testing

| Sub-issue | Owns |
|---|---|
| #121 | Migration spec (`backend/src/database/tests/bank-*-migration.spec.ts`), `integration/bank-schema.integration-spec.ts`, write-through specs |
| #122 | Entity / schedule / DTO / resolver units, `provider-bills.e2e-spec.ts`, `bills.e2e-spec.ts` extension |
| #123 | `occurrences`, `calendar-units`, `bill-history`, `bill-payment.writer` units; `bill-payments.e2e-spec.ts`, `calendar.e2e-spec.ts` extensions; alias specs |
| #124 | Frontend Jasmine specs |
| #125 | Contract migration spec, `provider-expense-accounts.e2e-spec.ts` (schedule field → `400`), `OccurrenceKind` rename |
| all | `accountant.e2e-spec.ts` stays green, unchanged |

## Future epics

Each becomes a GitHub epic at fold time (#126) and its URL is recorded where the lasting docs
mention it. The epics #85, #86, #89, #96 and #97 name provider-level fields and need their docs
re-read.

- **Per-transaction bill link** — link a ledger transaction to the bill that produced it. Must
  keep the ledger and accountant hand-off intact. From [model.md](model.md).
- **Archiving an individual bill while keeping its history** — e.g. a cancelled phone line. Until
  then the workaround is `show_in_calendar: false`, stated in the UI. From
  [model.md](model.md) and [ui/provider-bills.md](ui/provider-bills.md).
- **Combined calendar across owners
  ([#101](https://github.com/darthjee/ward/issues/101))** — must be written against the new
  occurrence shape (`source_bill`, per-bill keys). From [api/payments.md](api/payments.md) and
  [ui/calendar.md](ui/calendar.md).

## Reference

- [Epic #119](https://github.com/darthjee/ward/issues/119)
- [Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md)
- [Bank — Bills](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md)
- [Bank — Provider-expense accounts](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/provider-expense.md)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)

## Required tests

See [Testing](#testing) above and the Required tests section of each file.
