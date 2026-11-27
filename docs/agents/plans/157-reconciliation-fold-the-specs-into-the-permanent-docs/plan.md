# Plan: Reconciliation — fold the specs into the permanent docs

Issue: [157-reconciliation-fold-the-specs-into-the-permanent-docs.md](../../issues/157-reconciliation-fold-the-specs-into-the-permanent-docs.md)

## Overview

Phase 4 (fold) of epic #85. The architect moves the lasting content of
`docs/agents/specs/reconciliation/` (model, API, locks, security decisions, UI) into the
permanent docs as shipped behavior. That includes a new concern page
`modules/bank/reconciliation.md` and a new `## Reconciliations` section in
`backend/routes/bank.md`. The architect also opens the three follow-up epics, deletes the spec
folder and moves its row to *Completed specs*. The backend agent then repoints the 12 backend
source comments that still cite `docs/agents/specs/reconciliation/...`. The same thing was done
for the earlier bank/auth folds by #105. Without it the issue's "no link to
`specs/reconciliation/` remains anywhere in the repo" criterion fails. The PR closes #85.

## Agents involved

- [architect](architect.md): documentation fold, follow-up epics, spec removal (runs first)
- [backend](backend.md): repoint code comments to the new permanent anchors (runs after the architect)

## Shared contracts

The backend comments cite a **file path plus a section name** (the existing comments use the
form ``see `docs/agents/<path>.md`, *Section*``). The architect must create these sections with
**exactly** these headings, and the backend must point at them. If the architect has to rename
a heading, it updates this table in the same PR before the backend step runs.

**New page `docs/agents/modules/bank/reconciliation.md`**, with these headings:

| Heading | Replaces spec section |
|---|---|
| `## Reconciliation entity` | `model.md` § `Reconciliation` entity, § `Transaction` change |
| `## Formulas` | `model.md` § Formulas (and § Queries and indexes, as `### Queries and indexes`) |
| `## Statement lifecycle` | `model.md` § Statement lifecycle (eligibility rules included) |
| `## Lock matrix` | `model.md` § Lock matrix |
| `## Migration` | `model.md` § Migration, § Backward compatibility |
| `## Concurrency` | `security.md` § Concurrency (the common lock order) + `api/reconciliations.md` § Concurrency |
| `## Memory` | `security.md` § Memory |
| `## Data sensitivity and ownership` | `security.md` § Decided (roles, response fields, sensitivity), § Input bounds |

**Existing page `docs/agents/backend/routes/bank.md`**, with these new headings:

| Heading | Replaces spec section |
|---|---|
| `## Reconciliations` | `api/reconciliations.md` § Routes |
| `### Reconciliation check order` | `api/reconciliations.md` § Check order |
| `### Reconciliation error codes` | `api/reconciliations.md` § Error codes |
| `### Reconciliation caching` | `api/reconciliations.md` § Caching + `api/existing-routes.md` § Caching |
| `## Reconciliation locks on existing routes` | `api/existing-routes.md` § Transactions, § Accounts, § Bill payments |

**Comment → target mapping** (backend):

| File | Today cites | Point at |
|---|---|---|
| `backend/src/database/migrations/20261123120027-bank-create-reconciliations.ts` | `specs/reconciliation/model.md` | `modules/bank/reconciliation.md`, *Reconciliation entity* / *Migration* |
| `backend/src/bank/entities/reconciliation.entity.ts` | `specs/reconciliation/model.md` | `modules/bank/reconciliation.md`, *Reconciliation entity* |
| `backend/src/bank/reconciliation-balance.ts` | `model.md`, *Formulas* | `modules/bank/reconciliation.md`, *Formulas* |
| `backend/src/bank/reconciliation-eligibility.ts` | `model.md` | `modules/bank/reconciliation.md`, *Statement lifecycle* |
| `backend/src/bank/transaction.writer.ts` | `model.md` lock matrix | `modules/bank/reconciliation.md`, *Lock matrix* |
| `backend/src/bank/tests/transaction-locks.e2e-spec.ts` | `model.md` lock matrix | `modules/bank/reconciliation.md`, *Lock matrix* |
| `backend/src/bank/tests/support/in-memory-reconciliation-repos.ts` | `model.md` | `modules/bank/reconciliation.md`, *Reconciliation entity* |
| `backend/src/bank/reconciliation.query.ts` | `security.md`, *Memory* | `modules/bank/reconciliation.md`, *Memory* |
| `backend/src/bank/reconciliation-conflicts.ts` | `security.md`, *Data sensitivity* | `modules/bank/reconciliation.md`, *Data sensitivity and ownership* |
| `backend/src/bank/bill-payment-undo-locks.ts` | `security.md` lock order | `modules/bank/reconciliation.md`, *Concurrency* |
| `backend/src/bank/reconciliation-guards.ts` | `api/reconciliations.md`, *Concurrency* and *Check order* | `modules/bank/reconciliation.md`, *Concurrency*, and `backend/routes/bank.md`, *Reconciliation check order* |
| `backend/src/bank/account-reconciliation-guard.ts` | `api/existing-routes.md`, *Accounts* | `backend/routes/bank.md`, *Reconciliation locks on existing routes* |

The authoritative list is the output of
`grep -rn "specs/reconciliation" --exclude-dir=node_modules --exclude-dir=.git backend frontend proxy navi scripts .claude`.
Any extra hit found there is handled the same way.
