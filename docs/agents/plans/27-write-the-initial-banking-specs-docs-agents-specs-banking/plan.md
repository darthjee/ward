# Plan: Write the initial banking specs (docs/agents/specs/banking/)

Issue: [27-write-the-initial-banking-specs-docs-agents-specs-banking.md](../../issues/27-write-the-initial-banking-specs-docs-agents-specs-banking.md)

## Overview

Documentation-only change. Create the spec skeletons `docs/agents/specs/auth/` and
`docs/agents/specs/banking/` for Epic #26 (Bank module), recording only the facts already decided
and leaving one clearly owned stub per file for the enhancement sub-issues #28–#33, then register
both folders under *Active specs* in `docs/agents/specs.md`. Owned by the architect (all files are
under `docs/agents/`); no specialist agent has work.

## Context

- The spec lifecycle and conventions live in `docs/agents/specs.md`: one `README.md` per feature
  (overview, purpose, scope, decision, index, sub-issue → file map), files split by concern, and
  **every file ends with a `## Reference` section (GitHub web URLs only, never local paths) and a
  `## Required tests` section**.
- Prior example of a first spec sub-issue: commit `8a837ac` (Fix #12 — `specs/deploy/`). Its shape
  is a good template for tone and section layout.
- Decided facts (write them as decisions):
  - `Organization` — new entity owned by the `auth` module (same module as `User`).
  - `OrganizationMembership` — many-to-many user ↔ organization with `role` of `owner`, `admin`
    or `user`; distinct from Ward's global admin role (`User.role` / `@AdminOnly()`).
  - An organization is created automatically for each new user.
  - Bank data is scoped to organizations. This changes the rule in `product.md` ("every domain
    record … belongs to exactly one user") — **announce only**; #28 specifies it, the fold issue
    applies it. Do **not** edit `product.md`.
  - `Account` with `type`: `regular`, `debt`, `investment`, `provider_expense`.
  - Main accounts list shows `regular` only; debt and provider-expense accounts have their own place.
  - Bank menu: **Accounts** (regular only), a place for **debt / provider-expense accounts**
    (exact split decided later), and a **Calendar** of upcoming bills.
  - Folder is `banking`; module is `bank` — stated once at the top of the banking `README.md`.
- Stub convention for files owned by a later sub-issue: a short "Owned by #NN" note, any decided
  facts relevant to the file, an **Open questions** checklist (`- [ ] …`), `## Reference`, and
  `## Required tests` reading exactly `TBD — defined by #NN`.
- GitHub URL base for references: `https://github.com/darthjee/ward` (e.g.
  `https://github.com/darthjee/ward/issues/26`,
  `https://github.com/darthjee/ward/blob/main/docs/agents/specs.md`).

## Steps

- [01 — Write the auth spec folder](plan/01-auth-specs.md)
- [02 — Write the banking README](plan/02-banking-readme.md)
- [03 — Write the accounts specs](plan/03-accounts-specs.md)
- [04 — Write bills and UI specs](plan/04-bills-and-ui-specs.md)
- [05 — Register the active specs](plan/05-register-active-specs.md)

## Notes

- Out of scope: fields beyond the entity names, routes, DTOs, permission matrices, cache classes
  (all belong to #28–#33); editing `product.md` or `AGENTS.md`; any code, migration or frontend
  change. Root files and `index.md`/`summary.md` link only to the `specs.md` hub, so they need no
  change.
- Each file must have exactly one owning issue so #28–#33 can run in parallel without conflicts;
  `ui/menu.md` is the one shared file, so structure it as a table with one row per submenu and
  say each sub-issue edits only its own row.
- No CI job validates `docs/`; verify manually that every new file ends with `## Reference`
  (web URLs only — grep for `/Users/` or relative `../` paths in Reference sections) and
  `## Required tests`, and that all relative intra-doc links resolve.
