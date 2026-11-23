# Plan: Reconciliation — backend: migration and entity

Issue: [164-reconciliation-backend-migration-and-entity.md](../../issues/164-reconciliation-backend-migration-and-entity.md)

## Overview
This builds the data foundation for epic #85 (statement checkpoints), with no route added or changed: the `bank_reconciliations` migration, the `Reconciliation` entity and the `Transaction.reconciliationId` column. It also adds the error codes and 409 factories, the pure formula and eligibility helpers, the cleared-balance, ticked-sum and ledger query changes, and the test support that #165 and #166 build on. The work is backend-only.

See [backend.md](backend.md) for the full plan.
