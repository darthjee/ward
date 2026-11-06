# Plan: Review the organization specs: optional organizations and bank data ownership

Issue: [40-review-the-organization-specs-optional-organizations-and-bank-data-ownership.md](../../issues/40-review-the-organization-specs-optional-organizations-and-bank-data-ownership.md)

## Overview

This is a documentation-only change, owned by the architect (`docs/agents/`). It revisits the
#28 decision that organizations are mandatory. Organizations become optional, and `bank` becomes
a **user-or-organization-owned** module: every `bank_accounts` row has exactly one owner, either
a user or an organization. The generic rule (the module kind, the owner-context guard and the
`core` token) goes in `specs/auth/organizations.md`. The bank-specific contract (column names,
route prefixes, per-owner name uniqueness) goes in `specs/banking/README.md`.

## Context

- Today `specs/auth/organizations.md` auto-creates an organization at registration and scopes
  all bank data to organizations (`/api/orgs/:orgId/bank/...`, `@OrgScoped()`).
- The issue replaces this with:
  - optional organizations (none created at registration);
  - one owner per account (nullable `user_id` / `organization_id` on `bank_accounts`, with an
    exactly-one check constraint);
  - child records that inherit their owner through their account;
  - personal routes (`/api/bank/...`, `/bank/...`) next to organization routes;
  - one `@OwnerScoped()` decorator backed by a `core` DI token that `auth` implements;
  - a Personal / organizations context switcher;
  - uniform 404s, and no owner fields in input or output.
- Out of scope for this issue, and done by #41: per-spec edits in `accounts/README.md`,
  `regular.md`, `transactions.md`, `debt.md`, `investment.md` and `ui/menu.md`.
- Also out of scope: `product.md`, `.claude/agents/data-access.md`, other modules, and backfill.

## Steps

- [01 — Rewrite the organizations spec](plan/01-rewrite-organizations-spec.md)
- [02 — Update the banking README](plan/02-update-banking-readme.md)
- [03 — Update the auth specs README](plan/03-update-auth-readme.md)

## Notes

- **Consult `product-owner`** (read-only) before writing step 01. Confirm that the
  user-or-organization-owned module kind and the Personal context fit `product.md`'s module
  and account definitions. Do not edit `product.md`; that happens at fold time, per `specs.md`.
- **No code and no CI impact.** Only Markdown under `docs/agents/specs/` changes, and no CI job
  lints docs. Check links by hand: in-repo relative links inside the specs, and GitHub web URLs
  in every `## Reference` section, per `specs.md` conventions.
- Every edited file must still end with `## Reference` and `## Required tests`.
- **Known inconsistency.** Until #41 lands, the account/transaction/debt/investment/menu specs
  still say "organization-scoped" and use `@OrgScoped()`. The README note from step 02 must say
  so explicitly. Do not touch those files here.
- Keep the organization entities, the `/orgs` routes, the role rules (stored, not enforced),
  the single-owner rule and the deferred epics (permission system, joining, closing, rate limit)
  unchanged. Only remove or reword what depends on auto-creation or mandatory membership.
- Future epic 3 ("Closing organizations") says closing "makes the zero-organizations state
  reachable". Reword it: zero organizations is now the normal state.
- Several Future epics (e.g. linked transfers, currency conversion's "organization base
  currency") say "organization". Leave those wordings for #41 unless a change is trivial. If
  touched, use "owner".
