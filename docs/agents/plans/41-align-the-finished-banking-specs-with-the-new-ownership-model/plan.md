# Plan: Align the finished banking specs with the new ownership model

Issue: [41-align-the-finished-banking-specs-with-the-new-ownership-model.md](../../issues/41-align-the-finished-banking-specs-with-the-new-ownership-model.md)

## Overview

Documentation-only realignment of the banking specs written by #29–#31 to the
user-or-organization ownership model settled by #40 (PR #42). Every listed spec moves from
organization-only scoping (`/api/orgs/:orgId/bank`, `@OrgScoped()`, per-organization
uniqueness, membership-only permissions, `createdByUserId`) to the owner-context rules: personal
(`/api/bank`, `/bank`) and organization (`/api/orgs/:orgId/bank`, `/orgs/:orgId/bank`) prefixes,
`@OwnerScoped()`, per-owner name uniqueness via two unique indexes, owner fields never in bodies
or responses, and no `created_by` column. No code changes.

## Context

- **Two sources of truth, no new file**: the banking README "Bank ownership contract" (bank-level
  rule, already placed by #40 — not edited here) and `accounts/regular.md` (operational details:
  `<base>` / `<ui>` placeholders, Rules, Data sensitivity, the owner-context test matrix).
  `transactions.md`, `debt.md`, `investment.md` link to those two instead of restating them.
- **Exploration findings** (beyond what the issue lists):
  - `transactions.md` "Transaction entity" has an `organizationId` field row "Copied from the
    account (every bank record carries a logical `organizationId`)". This contradicts the
    contract ("child records inherit the owner through their account and never store a copy")
    and must be dropped with the `createdByUserId` row.
  - Anchors `regular.md#detail--orgsorgidbankaccountsaccountid` are used in `transactions.md`
    (line ~139), `debt.md` (~100, ~142) and `investment.md` (~111, ~140). `debt.md` and
    `investment.md` headings also carry paths (`### List — /orgs/:orgId/bank/debts`, …); their
    `#debts-submenu-ui` / `#investments-submenu-ui` anchors (used by `ui/menu.md`,
    `investment.md`) are section-level and stay stable.
  - `debt.md` / `investment.md` frontend tests and edge cases already use `/bank/...` paths for
    wrong-type deep links; they become `<ui>/...`.
  - `transactions.md` "Alternatives considered" says "rejected in favour of an
    organization-scoped `settings.json`", and "Settings" says "Kept organization-scoped"; both
    become owner-scoped.
  - Not touched (out of scope): `auth/organizations.md`, the README "Bank ownership contract",
    `product.md`, `.claude/agents/data-access.md`, the type-specific decisions of #29–#31.
- No agent other than the architect has work: every file is under `docs/agents/`. Consult
  `product-owner` (read-only) once the edits are drafted, as the issue asks.

## Steps

- [01 — Realign regular.md (the operational source of truth)](plan/01-realign-regular.md)
- [02 — Realign transactions.md](plan/02-realign-transactions.md)
- [03 — Realign debt.md](plan/03-realign-debt.md)
- [04 — Realign investment.md](plan/04-realign-investment.md)
- [05 — Update accounts/README.md, ui/menu.md and the #27 stubs](plan/05-update-index-menu-and-stubs.md)
- [06 — Update the banking README](plan/06-update-banking-readme.md)
- [07 — Verify links, grep for leftovers, consult product-owner](plan/07-verify-and-review.md)

## Notes

- **No docs CI**: CircleCI (`.circleci/config.yml`) runs backend/frontend/proxy jobs only, so
  nothing checks Markdown links. Anchors are verified manually in step 07.
- **Anchor rule (GitHub slugs)**: `### List` → `#list`, `### Detail` → `#detail`,
  `### Create / Edit` → `#create--edit`. Used the same way in `regular.md`, `debt.md` and
  `investment.md`; links are always file-qualified (`regular.md#detail`), so identical anchors in
  different files do not clash.
- **Sequencing**: step 01 first (the others link to its new anchors and placeholders); 02–05 are
  independent of each other; 06 after 01–05 (index wording describes their final content); 07
  last. #32 / #33 start only after this lands.
- **Type-specific content is frozen**: only ownership, routes, UI paths, uniqueness, permissions,
  caching wording and tests change. Do not touch ledger sign rules, debt / investment fields,
  shortcuts, etc.
- Future epic 8 (*Currency conversion*) mentions "an organization base currency"; leave it as is
  (not an ownership rule — the epic decides). Mention it only if `product-owner` flags it.
- Keep each spec's **Reference** and **Required tests** sections; in References, replace the
  "Organizations, `@OrgScoped()`" line with "Organizations, `@OwnerScoped()`, data-ownership
  rule" pointing to #28, #40 and `auth/organizations.md`.
