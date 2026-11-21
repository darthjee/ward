# Plan: Organization permissions: backend role enforcement

Issue: [143-organization-permissions-backend-role-enforcement.md](../../issues/143-organization-permissions-backend-role-enforcement.md)

## Overview

Enforce the organization role matrix (`user` < `admin` < `owner`) in the backend. The
`OwnerContextGuard` reads the caller's role from its existing single membership lookup (the port
now has `findRole`) and checks it against a new `@MinOrgRole` handler decorator. A coverage spec
fails on any owner-scoped write without a role. Two rules depend on records or sit outside the
owner scope: editing a payment-generated transaction (checked in `TransactionService`) and
renaming an organization (checked in `OrganizationService#rename`). All code changes are in
`backend/`. There is no migration.

See [backend.md](backend.md) for the full plan.

## Review and documentation (outside the backend plan)

- `security` and `data-access` review the guard, the port change, the 404-before-403 order and
  the payment-generated check.
- `cache` confirms there are no new cache classes: writes and 403s stay `never`, and Navi does
  not change.
- Folding the matrix into the permanent docs is a sibling sub-issue. Note for it: on the wire,
  the 403 has the global `HttpExceptionFilter` shape
  `{ error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode: 403, timestamp }`, the same
  way the uniform 404 does. The frontend sub-issue must mirror that shape.
