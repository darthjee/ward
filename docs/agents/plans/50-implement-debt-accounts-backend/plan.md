# Plan: Implement debt accounts — backend

Issue: [50-implement-debt-accounts-backend.md](../../issues/50-implement-debt-accounts-backend.md)

## Overview
Add the `debt` account type to the `bank` backend module: a 1:1 `bank_debt_details` table, a
`DebtAccountHandler` plugged into the existing `AccountTypeRegistry`, a nested `debt` object on
the generic account routes (create, partial-merge PATCH, list `?type=debt`, detail), the
validation and edge cases of `docs/agents/specs/banking/accounts/debt.md`, and the matching
doc updates. No new routes, no Navi changes.

See [backend.md](backend.md) for the full plan.
