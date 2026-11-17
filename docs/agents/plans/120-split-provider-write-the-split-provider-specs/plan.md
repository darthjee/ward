# Plan: split-provider: write the split-provider specs

Issue: [120-split-provider-write-the-split-provider-specs.md](../../issues/120-split-provider-write-the-split-provider-specs.md)

## Overview

Docs-only sub-issue (first of epic [#119](https://github.com/darthjee/ward/issues/119)). Create
`docs/agents/specs/split-provider/` with a `README.md` and seven concern files (`model.md`,
`migration.md`, `security.md`, `api/provider-bills.md`, `api/payments.md`,
`ui/provider-bills.md`, `ui/calendar.md`), register the feature under *Active specs* in
`docs/agents/specs.md`, and settle the four concerns the epic left open (caching, data
sensitivity & ownership, performance & security, testing split). The epic body is transcribed
into the concern files as **decisions, not code**. Owned by the `architect`; no specialist edits
any file, but `product-owner`, `security`, `data-access` and `cache` are consulted (read-only)
before the concern files are written.

## Context

- Today a `provider_expense` account carries exactly one recurring schedule in
  `bank_provider_expense_details` (`expected_amount`, `charge_frequency`, `due_day`,
  `due_month`, `bills_from`, `show_in_calendar`, `paying_account_id`). The epic replaces it with
  N `ProviderBill` rows in one table `bank_provider_bills` (renamed from `bank_bills`) with an
  immutable `kind` of `recurring` / `one_off`, delivered expand / contract over #120–#126.
- `docs/agents/specs.md` defines the lifecycle and conventions: one `README.md` per feature with
  an index, files split by concern, each file ending with **Reference** (GitHub web URLs only,
  never local paths) and **Required tests** sections, a `## Future epics` section in the README,
  and only `specs.md` (not root files / `index.md` / `summary.md`) links to the feature folder.
- Precedent: commit `4a11dce` (#27) created `docs/agents/specs/banking/` the same way; its shape
  is a useful template (`git show 4a11dce`).
- Full design source: the epic body of #119 (`gh issue view 119`) — Proposal, Semantics 1–12,
  API surface, Migration, UI, Scope and epic breakdown, Transition rules, Backward
  compatibility, Performance and security, Out of scope, Design decisions, Edge cases,
  Implementation notes, Testing.
- Starting positions recorded in the issue (caching inherited from `OwnerScopedController` +
  `InvalidatesOwner()`; Navi never warms user-scoped; owner-only personal data, no global-admin
  access, all org members full access until #81) are to be confirmed or revised.

## Steps

- [01 — Consult the reviewer agents](plan/01-consult-reviewers.md)
- [02 — Write the README and register the active spec](plan/02-readme-and-hub.md)
- [03 — Write model.md](plan/03-model.md)
- [04 — Write migration.md](plan/04-migration.md)
- [05 — Write security.md](plan/05-security.md)
- [06 — Write the API specs](plan/06-api.md)
- [07 — Write the UI specs](plan/07-ui.md)
- [08 — Cross-check and finalize](plan/08-cross-check.md)

## Notes

- No code, no migration, no test changes: nothing under `backend/`, `frontend/`, `proxy/`,
  `navi/` is touched, so no CI job is affected (CircleCI has no docs job).
- Do **not** edit the permanent docs (`modules/bank/bills.md`, `provider-expense.md`, `ui.md`,
  `backend/routes/bank.md`, `product.md`) in this issue. The specs record that the "No
  standalone recurring bills" decision is reversed; the permanent rewrite happens at fold time
  (#126). While the spec is active, `specs.md` makes it the source of truth.
- The epic's implementation note says the provider route family goes in `frontend/app/routing/`;
  that path does not exist. The router tables live in
  `frontend/assets/js/utils/routing/routes.js` (see `docs/agents/architecture/frontend.md`).
  The UI spec must name the correct location.
- The epic's migration outline is superseded in shape by its *Scope and epic breakdown*
  (expand in #121, contract in #125). `migration.md` must describe the split, not the original
  single-migration outline.
- Sub-issue numbering: the epic numbers sub-issues 1–7; the GitHub issues are #120–#126
  (1 → #120, 2 → #121, … 7 → #126). Use the GitHub numbers everywhere in the specs.
- If a consulted reviewer revises a starting position, the spec records the revised decision and
  the README notes that it supersedes the epic.
