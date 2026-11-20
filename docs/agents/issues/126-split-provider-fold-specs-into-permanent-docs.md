# Issue: Split provider — fold specs into permanent docs

## Description

Last sub-issue of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
Fold `docs/agents/specs/split-provider/` into the permanent docs, open its Future epics, and
delete the spec folder, following the lifecycle in
[Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md).

All prerequisites have shipped: the contract step
[#125](https://github.com/darthjee/ward/issues/125) and the frontend sub-issues
[#131](https://github.com/darthjee/ward/issues/131),
[#132](https://github.com/darthjee/ward/issues/132) and
[#133](https://github.com/darthjee/ward/issues/133).

## Problem

Now that the contract step has shipped, the spec folder is the only place describing provider
bills, and the permanent docs still describe "one schedule per provider". That includes
`modules/bank/bills.md`'s "No standalone recurring bills … Decided against, not deferred",
which the epic reversed.

## Expected Behavior

- Lasting content folded into:
  - `modules/bank/bills.md`: rewrite the "No standalone recurring bills" paragraph; add provider
    bills, kinds, payment keys and the schedule-fields section;
  - `modules/bank/provider-expense.md`: fields table, rules, "one account per provider" wording,
    and the access rules from `security.md` (owner-only, no global-admin access, all org members
    have full access until [#81](https://github.com/darthjee/ward/issues/81));
  - `modules/bank/ui.md`: the Providers section (including the per-provider `bills_summary` from
    #133) and the Add / edit bill sections;
  - `backend/routes/bank.md`: new routes, removed routes, `OccurrenceKind`, the `bills_summary`
    field on the provider list payload, and the caching classes (GETs `user-scoped`, writes
    `never` with `InvalidatesOwner()`, Navi warms nothing);
  - `product.md`: the `bank` bullets on bills.
- Spec files with no lasting destination are dropped rather than folded:
  - `migration.md` (expand / contract delivery history, which stays in git);
  - the per-sub-issue Delivery and Testing tables in `README.md`.
- One GitHub epic created per entry in the spec's `## Future epics` that does not have one yet:
  - **Per-transaction bill link**: link a ledger transaction to the bill that produced it,
    keeping the ledger and the accountant hand-off intact;
  - **Archiving an individual bill while keeping its history**: until it ships, the workaround is
    `show_in_calendar: false`, stated in the UI.

  Each new epic is labelled `Epic` and `Idea`, has a short body seeded from the spec text, and
  cross-references #119. Its URL is recorded where the lasting docs mention the concern.
- Combined-calendar epic [#101](https://github.com/darthjee/ward/issues/101) updated to point at
  the new occurrence shape (`source_bill`, per-bill keys).
- Epics [#85](https://github.com/darthjee/ward/issues/85),
  [#86](https://github.com/darthjee/ward/issues/86),
  [#89](https://github.com/darthjee/ward/issues/89),
  [#96](https://github.com/darthjee/ward/issues/96) and
  [#97](https://github.com/darthjee/ward/issues/97) re-read. Any that name provider-level
  schedule fields get a comment pointing at the new model.
- `docs/agents/specs/split-provider/` deleted. Its entry moves from *Active specs* to
  *Completed specs* in `docs/agents/specs.md`, listing the folded docs and the follow-up epics.
  *Active specs* reads "none" if nothing else is in progress.

## Solution

Owned by the `architect` agent. Docs and GitHub issues only; no code changes. Links use GitHub
web URLs, never local paths.
