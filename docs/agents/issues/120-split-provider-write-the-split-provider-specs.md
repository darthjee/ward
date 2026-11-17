# Issue: split-provider: write the split-provider specs

## Description

First sub-issue of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
Write the feature specs under `docs/agents/specs/split-provider/` that every later sub-issue of
the epic builds against, and settle the concerns the epic deliberately left open.

Today a `provider_expense` account carries exactly one recurring schedule
(`bank_provider_expense_details.expected_amount`, `charge_frequency`, `due_day`, `due_month`,
`bills_from`, `show_in_calendar`, `paying_account_id`). The epic replaces it with N
`ProviderBill` rows per provider — one table `bank_provider_bills` (renamed from `bank_bills`)
with an immutable `kind` of `recurring` or `one_off` — delivered expand / contract over the
sub-issues #120–#126.

## Problem

The epic's decisions currently live only in the GitHub issue body. Per
[Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md), a multi-issue
feature needs a spec folder that is the source of truth while its sub-issues are built, so that
implementation issues do not re-decide the data model, API, security or UI. Several concerns
were also explicitly deferred to this sub-issue.

## Expected Behavior

- `docs/agents/specs/split-provider/` exists (the `docs/agents/specs/` folder is created too) with:
  - `README.md` — overview, product decision (reversing "No standalone recurring bills" in
    `modules/bank/bills.md`), scope / out of scope, an index of every file, the sub-issue → file
    map below, and a `## Future epics` section (per-transaction bill link; archiving an
    individual bill while keeping its history; combined calendar across owners #101 against the
    new occurrence shape).
  - `model.md` — `ProviderBill` entity, `kind` semantics and column groups, validation matrix,
    description uniqueness among recurring bills only, `bank_bill_payments.provider_bill_id`
    and the three unique keys (narrowed `derived_due_date`, new `provider_bill_due_date`,
    `UNIQUE (bill_id)`), the 50-recurring-bills cap, indexes.
  - `migration.md` — the expand migration, the transition rules (write-through while ≤ 1
    recurring bill, `409 PROVIDER_HAS_MULTIPLE_BILLS`, compatibility aliases), the contract
    migration, rollback semantics of each, and the production-dump dry run.
  - `security.md` — data sensitivity and ownership (who may see or edit provider bills,
    including org `/orgs/:orgId/bank` visibility), and the performance & security decisions
    (owner-scoped uniform `404`, recurring bills locked to their provider, `:dueDate` validated
    per bill, the cap, the single-query calendar load and indexes).
  - `api/provider-bills.md` — nested list/create, top-level read/update/delete, pagination and
    ordering, all error codes (`PROVIDER_BILL_KIND_LOCKED`, `PROVIDER_BILL_PROVIDER_LOCKED`,
    `PROVIDER_BILL_NAME_TAKEN`, `PROVIDER_BILL_PAID`, `PROVIDER_BILL_LIMIT`), `bills.json`
    compatibility projection, and the cache class of every route.
  - `api/payments.md` — per-bill occurrence payment and history routes, `source_bill`,
    `OccurrenceKind` staging (`provider` kept until the contract step), off-schedule per bill,
    and the cache class of every route.
  - `ui/provider-bills.md` — provider detail Bills block, add / edit bill with the `kind`
    selector, provider list column ("3 bills · R$ 250,00/mo + R$ 1.200,00/yr"), per-bill history.
  - `ui/calendar.md` — Calendar occurrence label and the Pay form reading `source_bill`.
  - Every file ends with a **Reference** section (GitHub URLs) and a **Required tests** section.
- `docs/agents/specs.md` lists `split-provider` under *Active specs*.
- The following are **decided and written into the specs** (the epic only sketched them):
  - **Caching** (in `api/*.md`) — cache class of every new route and whether Navi warms any.
  - **Data sensitivity & ownership** (in `security.md`).
  - **Performance & security** (in `security.md`) — confirm or revise the epic's starting
    decisions.
  - **Testing** (in `README.md`, plus each file's Required tests) — which sub-issue owns which
    spec (unit, e2e, migration, frontend).

### Sub-issue → file map (starting point)

| Sub-issue | Reads |
|---|---|
| #121 expand migration | `model.md`, `migration.md`, `security.md` |
| #122 provider-bills CRUD API | `model.md`, `api/provider-bills.md`, `security.md` |
| #123 calendar, payments and history per bill | `model.md`, `api/payments.md`, `migration.md`, `security.md` |
| #124 frontend provider bills UI | `api/*.md`, `ui/*.md` |
| #125 contract | `migration.md`, `api/payments.md` |
| #126 fold specs into permanent docs | all files, `README.md` § Future epics |

## Solution

Docs only; no code changes. Owned by the `architect`. Consult the `product-owner`, `security`,
`data-access` and `cache` agents for their concerns while writing. The full design (proposal,
semantics, API surface, migration, UI, edge cases, design decisions, implementation notes, test
inventory) is in the epic body of [#119](https://github.com/darthjee/ward/issues/119) and is to
be transcribed into the concern files, describing decisions, not code.

Next sub-issue: #121, the expand migration, which builds against `model.md` and `migration.md`.

### Starting positions (from enhancement)

These come from existing repo conventions found during enhancement. The spec confirms them or
revises them while it is being written:

- **Caching:** the new provider-bill GETs inherit `user-scoped` from `OwnerScopedController`.
  Every write is `@CachePolicy(CacheClass.Never)` with `InvalidatesOwner()`, which clears the
  owner's `/bank` or `/orgs/:id/bank` subtree (`docs/agents/architecture/caching.md`). Navi does
  not warm them, because Navi never warms user-scoped endpoints (`docs/agents/cache-warmer.md`).
- **Data sensitivity & ownership:** provider bills inherit their owner through the provider
  account. Personal bank data is owner-only, and the global admin gets no access. In an
  organization every member has full access, because roles are not enforced until #81
  (`docs/agents/modules/auth/organizations.md`).
- Performance & security confirmation and the per-sub-issue testing split are decided while the
  spec is written.
