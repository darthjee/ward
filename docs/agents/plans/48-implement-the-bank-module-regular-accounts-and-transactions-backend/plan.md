# Plan: Implement the bank module, regular accounts and transactions — backend

Issue: [48-implement-the-bank-module-regular-accounts-and-transactions-backend.md](../../issues/48-implement-the-bank-module-regular-accounts-and-transactions-backend.md)

## Overview

Build Ward's first domain module and first lazy module, `bank`, in the backend. It covers
regular accounts, the transaction ledger with computed running balances, and the owner-scoped
`settings.json`. The work also adds record-level user-or-organization ownership and a type
registry, so the later account types (#50, #52, #54) can plug into the generic account routes.

The thin controllers, the entity classes and the boot-validated config are resident. The
services, the queries and all business logic live in the lazy `BankModule`, which loads on the
first bank request.

All implementation work is in `backend/`. The `docs/agents/` and `.env.dev.sample` edits in the
last step belong to the architect.

See [backend.md](backend.md) for the full plan.
