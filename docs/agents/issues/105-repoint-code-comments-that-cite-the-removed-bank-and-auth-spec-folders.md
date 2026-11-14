# Issue: Repoint code comments that cite the removed bank and auth spec folders

## Description
#58 folded the bank and organization feature specs into the permanent docs and deleted `docs/agents/specs/banking/` and `docs/agents/specs/auth/`. 36 backend source, test and migration files (under `backend/src/bank/`, `backend/src/auth/` and `backend/src/database/migrations/`) still cite paths inside those removed folders in their comments. #58 ruled out code changes, so these comments were left as they were.

## Problem
The comments point readers to files that no longer exist, so whoever follows them ends up at a broken link instead of at the rule the code implements.

## Expected Behavior
- `git grep -n "specs/banking\|specs/auth" -- backend frontend` returns nothing.
- Every repointed comment names an existing permanent page that documents the cited rule.
- Comment-only change: no code, test or migration behaviour changes.

## Solution
Replace each stale path with its permanent home:

| Removed path | Permanent page |
|---|---|
| `docs/agents/specs/banking/accounts/` (directory) | `docs/agents/modules/bank/accounts.md` |
| `docs/agents/specs/banking/accounts/regular.md` | `docs/agents/modules/bank/accounts.md` (Regular accounts section) |
| `docs/agents/specs/banking/accounts/transactions.md` | `docs/agents/modules/bank/transactions.md` |
| `docs/agents/specs/banking/accounts/debt.md` | `docs/agents/modules/bank/debt.md` |
| `docs/agents/specs/banking/accounts/investment.md` | `docs/agents/modules/bank/investment.md` |
| `docs/agents/specs/banking/accounts/provider-expense.md` | `docs/agents/modules/bank/provider-expense.md` |
| `docs/agents/specs/banking/bills.md` | `docs/agents/modules/bank/bills.md` |
| `docs/agents/specs/auth/organizations.md` | `docs/agents/modules/auth/organizations.md` |

Where a comment refers to per-endpoint detail (request/response shape of a route), it may point at `docs/agents/backend/routes/bank.md` or `docs/agents/backend/routes/auth.md` instead.

Out of scope: the generic `docs/agents/specs/<feature>/` mentions in `AGENTS.md` and `docs/agents/specs.md`, which describe the spec lifecycle and stay valid.

Owner: backend agent (all affected files are under `backend/`).

## Benefits
Comments lead readers straight to the current rule, and the codebase no longer refers to deleted documentation.
