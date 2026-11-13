# Plan: Fold the bank and organization specs into the permanent docs

Issue: [58-fold-the-bank-and-organization-specs-into-the-permanent-docs.md](../../issues/58-fold-the-bank-and-organization-specs-into-the-permanent-docs.md)

## Overview

This plan covers steps 3–5 of the spec lifecycle (`docs/agents/specs.md#lifecycle`) for Epic #26:

- open the 24 deferred **Future epics** as GitHub issues;
- fold `docs/agents/specs/banking/` into a new `modules/bank.md` hub and a `modules/bank/` folder;
- fold `docs/agents/specs/auth/` into a new `modules/auth/organizations.md`;
- repoint every permanent doc and agent file at the new pages;
- delete both spec folders and move their `specs.md` entries to *Completed specs*.

It is documentation and GitHub-issue work only. There is no code change. Every file touched is
in the architect's scope: `docs/agents/`, root files, and `.claude/agents/` / `.github/agents/`
(fallback owner). No specialist implements anything here.

The folded docs describe **what was built**. That means the code, `backend/routes/bank.md`,
and the backend and frontend divergence scans summarised in [Context](#context). Each
divergence from the specs is recorded in a short **"Differences from the original spec"**
section at the end of the page it affects.

## Context

### Spec files and where each one goes

| Spec file | Target |
|---|---|
| `specs/banking/README.md` (purpose, decisions, ownership contract) | `modules/bank.md` |
| `specs/banking/README.md` (Future epics) | 24 GitHub issues (step 01) |
| `specs/banking/accounts/README.md`, `accounts/regular.md` | `modules/bank/accounts.md` |
| `specs/banking/accounts/transactions.md` | `modules/bank/transactions.md` |
| `specs/banking/accounts/debt.md` | `modules/bank/debt.md` |
| `specs/banking/accounts/investment.md` | `modules/bank/investment.md` |
| `specs/banking/accounts/provider-expense.md` | `modules/bank/provider-expense.md` |
| `specs/banking/bills.md` | `modules/bank/bills.md` |
| `specs/banking/ui/menu.md`, `ui/calendar.md`, and the "submenu UI" sections of each accounts file | `modules/bank/ui.md` |
| `specs/auth/README.md`, `specs/auth/organizations.md` | `modules/auth/organizations.md` (plus routes in `modules/auth.md` and `backend/routes/auth.md`) |

Each spec's *Required tests* section is dropped, but the rules those tests verify are kept. The
*Sub-issue map* and *Implementation order* sections are dropped too. The *Reference* sections
are reduced to GitHub issue / PR links.

### Divergences found (spec vs implementation)

**Backend (organizations):**
- Table names are `auth_organizations` / `auth_organization_memberships` (the spec says
  `organizations` / `organization_memberships`). Their FKs point at `auth_users` with
  `ON DELETE RESTRICT`.
- "Exactly one `owner` membership" is not a DB constraint. It holds because
  `OrganizationService#create` is the only writer.
- Name validation also rejects control characters and counts length in code points
  (`backend/src/auth/dto/organization-name.dto.ts`).
- `PATCH /orgs/:orgId.json` checks the body first, so it answers 400 before 404.
- The owner-context mechanism is:
  - the global `OwnerContextGuard` (`APP_GUARD`);
  - the `ORGANIZATION_MEMBERSHIP_LOOKUP` port, implemented by `OrganizationService`;
  - `@OwnerScopedController(path)`, `@OwnerScoped()` and `@CurrentOwner()`;
  - the `ownerWhere()` / `ownerSqlWhere()` helpers (`backend/src/core/owner-*.ts`).

  The spec only says "a core guard behind a DI token".
- Unknown body fields are rejected by `@StrictBody()`, not by the whitelist `ValidationPipe`.
- Routes have no `/api` prefix in the backend (the proxy adds it). The specs write `/api/...`.
- The org list is ordered by id.

**Backend (bank):**
- The active-name key is accent-sensitive as well as case-insensitive (`utf8mb4_0900_as_cs`).
- `account_number` is masked in every response except the detail.
- `opening_date` is optional in the API. It defaults to UTC today and accepts dates up to
  UTC today + 1 day.
- Archive and unarchive answer 200 and are idempotent. An unknown `?type=` answers 400.
- The account response has no `has_transactions` flag.
- **Deleting an account** with no transactions also deletes its one-off bills and skip-only
  payment rows (`ON DELETE CASCADE`). The specs don't mention this.
- Schedule fields come back as `paying_account: { id, name } | null` in responses. The request
  takes `paying_account_id`.
- The accountant mark timestamp is truncated to whole seconds.
- `GET`, `PATCH` and `DELETE /bills/:id.json` answer 404 when the bill's provider is archived.
- A schedule also needs a non-null `bills_from` (decided in #56).

**Frontend:**
- The Calendar (list and month views, Pay / Skip / Undo dialogs, Calendar menu entry,
  `calendar.json` client calls) is **not built yet**. It waits on #77, which is still open.
  Until then, a one-off bill can be created but isn't listed anywhere.
- The Accounts list has an extra Branch column.
- Delete is shown only for active accounts with no transactions.
- Add / edit bill:
  - save, cancel and delete return to the provider detail page (or the Providers list);
  - the paying account is required on edit too;
  - the due date defaults to the local today;
  - 409 `BILL_PAID` is shown on save as well as on delete;
  - an unavailable `?provider=` preselect is silently dropped;
  - `/bank/bills` maps to Providers when the context switches.
- Bill history:
  - Undo is hidden on archived accounts;
  - the "sent charge" warning is always shown for paid provider and one-off payments;
  - it is paginated, with an "Off-schedule" badge.
- The "Bills from" autofill uses the browser's local today. The backend fallback uses UTC.
- A stale remembered org context is checked against the loaded `/orgs.json` list (no 404
  request), and only at the entry hash. A direct stale URL renders `NotFound` with "Go to
  Personal".
- The accountant CSV uses CRLF line endings.

## Steps

- [01 — Open the 24 Future epics](plan/01-open-future-epics.md)
- [02 — Fold the bank specs into `modules/bank.md` and `modules/bank/`](plan/02-fold-bank-specs.md)
- [03 — Fold the organization specs into the auth module docs](plan/03-fold-organization-specs.md)
- [04 — Update the other permanent docs and agent files](plan/04-update-permanent-docs.md)
- [05 — Remove the spec folders and update `specs.md`](plan/05-remove-specs.md)

## CI Checks

- None apply: CircleCI runs only backend, frontend and proxy tests and lint, and this issue
  touches no code. Before opening the PR, run the acceptance grep instead:
  `grep -rn "specs/banking\|specs/auth" AGENTS.md .claude/agents .github docs/agents --exclude-dir=issues --exclude-dir=plans`
  It must return nothing.

## Notes

- **Dependency on #77.** The Calendar views frontend is still open. If #77 hasn't merged when
  this is implemented, `modules/bank/ui.md` describes the Calendar from `ui/calendar.md` and
  marks it as "pending #77". Then either update it once #77 merges, or wait for #77 before
  merging this PR (preferred, since the issue lists #77 as a dependency). Re-check the frontend
  divergences above against #77 as merged.
- **Acceptance grep and `.claude/state/`.** `.claude/state/issue-27.json` contains
  `specs/banking`, but `.claude/state` is gitignored local state, so it is not part of the repo.
  Scope the check to tracked files (`git grep -n "specs/banking\|specs/auth" -- AGENTS.md .claude .github docs/agents ':!docs/agents/issues' ':!docs/agents/plans'`), and don't edit state files.
- **Frontend agent files.** `.claude/agents/frontend.md` and `.github/agents/frontend.agent.md`
  have no feature-spec references today. Their only "specs" mentions are `frontend/specs/`
  Jasmine paths, which stay. Confirm this in step 04. If there is nothing to repoint, add a
  pointer to `docs/agents/modules/bank/ui.md` next to the "Domain modules (`bank`, …)" sentence.
  Keep the `.claude/` and `.github/` copies identical apart from their frontmatter.
- **Gaps that may need their own issues** (the issue rules out fixing them here):
  - the silent cascade delete of one-off bills and skip rows when an account is deleted;
  - the missing `has_transactions` flag;
  - the stale "#57 Calendar" comment in `BankMenuHelper.jsx`;
  - the Bills-from local-vs-UTC mismatch.

  Open a separate issue only for the cascade delete (a possible data-loss surprise), and only
  if it isn't already tracked. Record the rest as divergences.
- Epics are created with `gh issue create -R darthjee/ward --label Epic --label Idea`. Both
  labels already exist.
- `frontend.md`'s directory layout is out of date (debts / investments / providers / bills pages
  and the `BillsClient` / `AccountantClient` clients are missing). Step 04 refreshes only the
  cross-cutting parts and links `modules/bank/ui.md`; it doesn't re-document bank pages there.
