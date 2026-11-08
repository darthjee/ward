# Plan: Implement investment accounts — backend

Issue: [52-implement-investment-accounts-backend.md](../../issues/52-implement-investment-accounts-backend.md)

## Overview
Add `investment` accounts to the `bank` backend module by mirroring what #50 did for debts: a
1:1 `bank_investment_details` table and migration, a nested `investment` DTO, and an
`InvestmentAccountHandler` registered in the account-type registry. The generic `AccountService`
keeps talking only to the registry. The handler contract gains one account-level hook,
`validateAccount(account)`, which enforces "`opening_balance` must be 0" on create and PATCH.

See [backend.md](backend.md) for the full plan.
