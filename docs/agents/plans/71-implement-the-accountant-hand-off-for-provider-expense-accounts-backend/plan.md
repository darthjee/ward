# Plan: Implement the accountant hand-off for provider-expense accounts — backend

Issue: [71-implement-the-accountant-hand-off-for-provider-expense-accounts-backend.md](../../issues/71-implement-the-accountant-hand-off-for-provider-expense-accounts-backend.md)

## Overview
Adds the accountant hand-off to the lazy `bank` backend module: a nullable
`bank_transactions.sent_to_accountant_at` column, the key on provider-expense charge responses,
a preview route (`GET <base>/accountant/charges.json`) and all-or-nothing, idempotent mark sent /
unsent routes, served by a new resident `AccountantController` that delegates to a lazy
`AccountantService`. The work is backend only, with docs updated in the same PR.

See [backend.md](backend.md) for the full plan.
