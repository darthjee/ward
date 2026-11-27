# Plan: Reconciliation — frontend: ledger markers

Issue: [168-reconciliation-frontend-ledger-markers.md](../../issues/168-reconciliation-frontend-ledger-markers.md)

## Overview
Frontend-only work, shared by all four account types through
`frontend/assets/js/components/resources/bank/common/`. The ledger table gets a cleared marker
and an "unreconciled" warning badge inside the description cell. Cleared rows get `amount`,
`date` and the direction toggle read-only in the ledger form, and Delete is hidden. The account
header gets a "Last reconciled" line, with the balance negated on debts. The account edit form
locks the opening fields, and the currency, once any statement exists (open or finished). The
backend fields already exist (#165, #166). The last step (docs) belongs to the architect.

See [frontend.md](frontend.md) for the full plan.
