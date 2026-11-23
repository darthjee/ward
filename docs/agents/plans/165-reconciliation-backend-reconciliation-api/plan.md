# Plan: Reconciliation — backend: reconciliation API

Issue: [165-reconciliation-backend-reconciliation-api.md](../../issues/165-reconciliation-backend-reconciliation-api.md)

## Overview

Adds the reconciliation routes (history, start, get, edit, cancel, ticks, finish, undo) under
`/bank` and `/orgs/:orgId/bank`, served by a new resident `ReconciliationsController` that
delegates to a lazy `ReconciliationService`. It also adds the shared deadlock 409 mapper that
#166 reuses, and the per-route and lifecycle e2e specs. All of the implementation work is in
`backend/`. When the backend work is done, the `security` and `cache` agents review it (read-only).

See [backend.md](backend.md) for the full plan.
