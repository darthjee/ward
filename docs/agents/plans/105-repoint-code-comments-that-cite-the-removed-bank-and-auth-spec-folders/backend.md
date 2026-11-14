# Backend Plan: Repoint code comments that cite the removed bank and auth spec folders

Main plan: [plan.md](plan.md)

## Overview
#58 deleted `docs/agents/specs/banking/` and `docs/agents/specs/auth/` after folding them into
`docs/agents/modules/bank/` and `docs/agents/modules/auth/`. 35 files under `backend/src/` still
cite the deleted paths in comments (one match per file; nothing in `frontend/`). Repoint each
comment to its permanent home, keeping the comment otherwise intact.

## Context
- All 35 matches are JSDoc blocks or `//` comments — none is inside a string literal or a test
  assertion, so the change cannot affect behaviour.
- No match uses a `#anchor`; some name a section in italics after the path (e.g. *One-off bills*).
  Those section names must be updated to the matching heading in the new page (table below).
- Most paths are in backticks; the four e2e specs cite the path in parentheses without backticks.
  Keep each file's existing style.
- Some comments wrap onto the next line (`schedule-fields.ts`, `pay-occurrence.dto.ts`,
  `occurrence-generator.ts`, `accountant.e2e-spec.ts`, `provider-expense-accounts.e2e-spec.ts`) —
  read both lines and fix any section name that continues there.

### Path mapping

| Removed path | Permanent page |
|---|---|
| `docs/agents/specs/banking/accounts/` (directory) | `docs/agents/modules/bank/accounts.md` |
| `docs/agents/specs/banking/accounts/regular.md` | `docs/agents/modules/bank/accounts.md` (*Regular accounts* section) |
| `docs/agents/specs/banking/accounts/transactions.md` | `docs/agents/modules/bank/transactions.md` |
| `docs/agents/specs/banking/accounts/debt.md` | `docs/agents/modules/bank/debt.md` |
| `docs/agents/specs/banking/accounts/investment.md` | `docs/agents/modules/bank/investment.md` |
| `docs/agents/specs/banking/accounts/provider-expense.md` | `docs/agents/modules/bank/provider-expense.md` |
| `docs/agents/specs/banking/bills.md` | `docs/agents/modules/bank/bills.md` |
| `docs/agents/specs/auth/organizations.md` | `docs/agents/modules/auth/organizations.md` |

### Section-name mapping (old spec section → current heading)

| Old section cited | New target |
|---|---|
| bills *One-off bills* | `modules/bank/bills.md` — *One-off bills* (unchanged) |
| bills *Validation* | `modules/bank/bills.md` — *Validation* (unchanged) |
| bills *Paying a bill* | `modules/bank/bills.md` — *Paying, skipping and undoing* |
| bills *Payment row* | `modules/bank/bills.md` — *Paying, skipping and undoing* (the `bank_bill_payments` row is described there) |
| debt / investment / provider-expense *Required tests* (e2e specs) | No such section exists any more. Point at the module page plus `docs/agents/backend/routes/bank.md` (per-endpoint behaviour the e2e tests exercise), and drop the *Required tests* section name |

Any other section name found on a wrapped line: pick the heading in the new page that covers
the same rule (`grep -n '^## ' <page>`); if none fits, drop the section name and keep the page.

## Implementation Steps

### Step 1 — Repoint the comments
Edit only the comment text in these files (paths under `backend/src/`), applying the mappings above:

- `auth/organizations.md` → `modules/auth/organizations.md`:
  `auth/entities/organization.entity.ts`, `database/migrations/20261107120015-auth-create-organizations.ts`
- `accounts/` directory → `modules/bank/accounts.md`: `bank/entities/account.entity.ts`
- `accounts/regular.md` → `modules/bank/accounts.md` (*Regular accounts*):
  `database/migrations/20261108120016-bank-create-accounts.ts`
- `accounts/transactions.md` → `modules/bank/transactions.md`:
  `database/migrations/20261108120017-bank-create-transactions.ts`
- `accounts/debt.md` → `modules/bank/debt.md`: `bank/account-types/debt-account.handler.ts`,
  `bank/account-types/debt-details.ts`, `bank/dto/debt-details.dto.ts`,
  `bank/entities/debt-details.entity.ts`, `bank/tests/debt-accounts.e2e-spec.ts`,
  `database/migrations/20261108120018-bank-create-debt-details.ts`
- `accounts/investment.md` → `modules/bank/investment.md`:
  `bank/account-types/investment-account.handler.ts`, `bank/account-types/investment-details.ts`,
  `bank/dto/investment-details.dto.ts`, `bank/entities/investment-details.entity.ts`,
  `bank/tests/investment-accounts.e2e-spec.ts`,
  `database/migrations/20261108120019-bank-create-investment-details.ts`
- `accounts/provider-expense.md` → `modules/bank/provider-expense.md`:
  `bank/account-types/provider-expense-account.handler.ts`,
  `bank/account-types/provider-expense-details.ts`, `bank/dto/provider-expense-details.dto.ts`,
  `bank/entities/provider-expense-details.entity.ts`, `bank/tests/accountant.e2e-spec.ts`,
  `bank/tests/provider-expense-accounts.e2e-spec.ts`,
  `database/migrations/20261108120020-bank-create-provider-expense-details.ts`
- `banking/bills.md` → `modules/bank/bills.md`: `bank/account-types/schedule-fields.ts`,
  `bank/bill-payment.service.ts`, `bank/bill.service.ts`, `bank/dto/create-bill.dto.ts`,
  `bank/dto/pay-occurrence.dto.ts`, `bank/entities/bill-payment.entity.ts`,
  `bank/entities/bill.entity.ts`, `bank/occurrence-generator.ts`, `bank/occurrence-response.ts`,
  `bank/paying-account.resolver.ts`, `database/migrations/20261108120022-bank-add-schedule-fields.ts`,
  `database/migrations/20261108120023-bank-create-bills.ts`

Migrations are already applied in production: editing their comments is safe (TypeORM tracks
migrations by class name/timestamp, not file content), but change nothing outside the comment.

### Step 2 — Verify
- `git grep -n "specs/banking\|specs/auth" -- backend frontend` returns nothing.
- Every new path resolves: e.g. `git grep -ho "docs/agents/[a-z/_-]*\.md" -- backend/src | sort -u | xargs ls`.
- `git diff` touches only comment lines.
- Run lint and tests through Docker (never on the host).

## Files to Change
- The 35 files listed in Step 1 (all under `backend/src/`) — comment text only.

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)

## Notes
- The issue says 36 files; the current grep finds 35 (one match each). Trust the grep — the
  acceptance criterion is an empty `git grep`.
- Out of scope: generic `docs/agents/specs/<feature>/` mentions in `AGENTS.md` and
  `docs/agents/specs.md` (they describe the spec lifecycle).
- No new endpoints, auth logic or input handling: no `security` or `cache` review needed.
