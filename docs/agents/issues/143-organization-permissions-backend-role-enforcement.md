# Issue: Organization permissions: backend role enforcement

## Description

Enforce the organization role matrix (`owner` / `admin` / `user`) in the backend. This is part of the *Organization permission system* epic (#81). It lands first because it fixes the shared contract (role order, 403 body, which actions need which role) that the frontend sub-issue mirrors.

## Problem

`OrganizationMembership.role` is stored but not enforced, so every member can do everything. This issue adds rules only, with no data migration.

## Expected Behavior

### Permission matrix

Reads are open to every member. Writes:

| Action | owner | admin | user |
|---|---|---|---|
| Create / edit transactions | ✅ | ✅ | ✅ |
| Create / edit bills and provider bills | ✅ | ✅ | ✅ |
| Pay a bill or provider bill (register a payment) | ✅ | ✅ | ✅ |
| Undo a payment | ✅ | ✅ | ❌ |
| Edit a payment-generated transaction | ✅ | ✅ | ❌ |
| Create / edit / archive / unarchive accounts | ✅ | ✅ | ❌ |
| Accountant mark-sent / mark-unsent | ✅ | ✅ | ✅ |
| Delete anything (accounts, transactions, bills, provider bills) | ✅ | ✅ | ❌ |
| Rename the organization (`PATCH /orgs/:orgId.json`) | ✅ | ✅ | ❌ |

Personal context is unaffected: the JWT user counts as `owner` of their own data.

### Route by route

Each owner-scoped write route (mounted under both the personal prefix and `orgs/:orgId/`) with its `@MinOrgRole`:

| Route | Min role |
|---|---|
| `POST accounts.json` | admin |
| `PATCH accounts/:accountId.json` | admin |
| `DELETE accounts/:accountId.json` | admin |
| `POST accounts/:accountId/archive.json` | admin |
| `POST accounts/:accountId/unarchive.json` | admin |
| `POST accounts/:accountId/transactions.json` | user |
| `PATCH accounts/:accountId/transactions/:transactionId.json` | user (+ payment-generated check in the service) |
| `DELETE accounts/:accountId/transactions/:transactionId.json` | admin |
| `POST bills.json` | user |
| `PATCH bills/:id.json` | user |
| `DELETE bills/:id.json` | admin |
| `POST accounts/:accountId/provider-bills.json` | user |
| `PATCH provider-bills/:id.json` | user |
| `DELETE provider-bills/:id.json` | admin |
| `POST accounts/:accountId/occurrences/:dueDate/payment.json` | user |
| `DELETE accounts/:accountId/occurrences/:dueDate/payment.json` | admin |
| `POST bills/:id/payment.json` | user |
| `DELETE bills/:id/payment.json` | admin |
| `POST provider-bills/:id/occurrences/:dueDate/payment.json` | user |
| `DELETE provider-bills/:id/occurrences/:dueDate/payment.json` | admin |
| `POST accountant/mark-sent.json` | user |
| `POST accountant/mark-unsent.json` | user |
| `PATCH orgs/:orgId.json` (rename) | admin |

- `POST orgs.json` (create organization) is not organization-scoped. Any authenticated user may create one and becomes its `owner`. No role applies.
- Bank settings are read-only (`GET settings.json` only), so there is nothing to gate.
- Any write route added later must declare its role (enforced by the coverage spec).

### Responses

- **403**: a member whose role is too low gets the uniform Nest default body `{ statusCode: 403, message: 'Forbidden', error: 'Forbidden' }`, built by one factory. It names neither the resource nor the required role.
- **404 first**: non-members, an unknown or malformed `:orgId` and wrong-context records keep today's uniform 404. This check always runs **before** the role check.

## Solution

### Mechanism

- **One lookup, role included**: `OwnerContextGuard` gets the caller's role from the lookup it already makes. The `ORGANIZATION_MEMBERSHIP_LOOKUP` port returns the role. No caching and no global `is_admin` bypass. No membership gives the same uniform 404 as today.
- **`@MinOrgRole(role)`**: a handler decorator that `OwnerContextGuard` reads right after it resolves the context. Order: `user` < `admin` < `owner`.
- **Closed by default**: a coverage spec (like the `@StrictBody()` / `@CachePolicy` ones in `core/tests/`) fails on any owner-scoped `POST`/`PATCH`/`PUT`/`DELETE` route without `@MinOrgRole`. Reads need no declaration.
- **Record-dependent rule**: editing a payment-generated transaction needs `admin`. Because this depends on the record, the transaction service checks it using the role from `OwnerContext`, on top of the route's `@MinOrgRole('user')`.
- **Role source**: the role comes only from the DB membership, never from the URL, body, JWT or client.

### `OrgRole` in `core`

- The role values and their order (`user` < `admin` < `owner`) move to `core` (e.g. `core/org-role.ts`), because `core` must not import `auth`. The file also holds a `hasMinRole(role, min)` helper and the uniform 403 factory.
- `auth`'s `MembershipRole` reuses that definition instead of duplicating it.

### Lookup port: `findRole`

- `OrganizationMembershipLookup.isMember()` is replaced by `findRole(userId, orgId): Promise<OrgRole | null>`. `null` means non-member, which gives the uniform 404.
- It keeps the same single indexed lookup on `(organization_id, user_id)` and the same guarantees: no existence pre-check, no caching, no admin bypass.
- `OrganizationService` implements it. `isMember` is removed (today only the guard calls it).

### Owner scope vs. owner context

`provider-bill-rescale.ts` builds an organization owner from an account record, with no caller and no role. To keep the role required wherever it is used, the two concepts are split:

- **`OwnerScope`** (`core/owner-context.ts`): today's union, `{ kind: 'user', userId } | { kind: 'organization', organizationId }`. It identifies only the data owner. `ownerWhere()`, `ownerSqlWhere()` and the bank helpers built on them (e.g. `accountOwnerWhere`) take an `OwnerScope`.
- **`OwnerContext`**: what `OwnerContextGuard` resolves per request. The organization variant becomes `{ kind: 'organization', organizationId, role }` with `role` required. The personal variant stays `{ kind: 'user', userId }` and counts as `owner` in `hasMinRole`. `OwnerContext` is structurally assignable to `OwnerScope`, so existing calls keep working.
- `provider-bill-rescale.ts` (`ownerOf(account)`) returns an `OwnerScope`. Any other place that derives an owner from a record instead of the request does the same.
- The guard, the specs and the test helpers (e.g. `bank/tests/account.test-support.ts`) that build an organization `OwnerContext` are updated to include a role.

### Rename

- `PATCH orgs/:orgId.json` is not owner-scoped and stays that way.
- `OrganizationService#rename` already loads the membership with its role. It checks `hasMinRole(role, 'admin')` and throws the uniform 403 after the existing 404.
- The deliberate order (400 body validation, then 404 membership, then 403 role) is kept. Rename is covered by e2e, not by the owner-scoped coverage spec.
- Its doc comment ("any role; last write wins") is updated.

### Payment-generated transaction rule

- A transaction is **payment-generated** when its id appears in any of `bank_bill_payments.payment_transaction_id`, `withdrawal_transaction_id` or `charge_transaction_id`. These are written by `BillPaymentWriter`. Each column has an FK to `bank_transactions`, so MySQL indexes it.
- On `PATCH accounts/:accountId/transactions/:transactionId.json`, **only when the role is `user`**, the transaction service runs one indexed `EXISTS` query against those three columns, scoped through the owner context. A match gives the same uniform 403 as the route-level check. `owner`, `admin` and personal context skip the query.
- The record is first looked up inside the owner context as today, so an unknown or wrong-context transaction still gets 404 before this check.
- `DELETE` of a transaction is already `admin`-only at the route, so it needs no extra check.

### Out of scope

- Member-management endpoints (list, change role, remove, leave, transfer): *Joining organizations* (#82).
- Closing an organization: #83.
- Frontend gating: sibling sub-issue.
- Folding into permanent docs: sibling sub-issue. Code doc comments (e.g. on `MembershipRole`, `OwnerContext`, `OwnerScope`) must still be accurate here.

### Testing

- Per-role e2e matrix: every organization write route against seeded `owner`, `admin`, `user` and non-member memberships, expecting 2xx / 403 / 404 per the matrix. Memberships are seeded directly, since joining arrives in #82.
- Guard unit specs: role ordering, personal counts as `owner`, a non-member gets 404 before the role check, a too-low role gets 403 with the uniform body.
- Coverage spec for undeclared owner-scoped writes.
- Service specs: editing a payment-generated transaction as `user` gives 403; as `admin` it is allowed.

### Caching, compatibility, footprint

- No new cache classes. Writes (and 403s) stay `never`. No Navi change.
- No migration. Every existing organization has a single `owner`, who keeps full access, so production behaviour is unchanged until #82 adds other members.
- Negligible memory: one role comparison per request and the same single DB lookup.

### Owning modules

- `core`: guard, `OwnerScope` / `OwnerContext`, `@MinOrgRole`, `OrgRole`, lookup port.
- `auth`: provides the role through the port; rename route.
- `bank`: route declarations, payment-transaction check, `OwnerScope` in record-derived owners.
- `bank` reads memberships only through the port.
- Agent: `backend`.

## Benefits

- Organizations can safely add non-owner members (#82): destructive and structural actions are reserved to `admin`/`owner`.
- Closed by default: a write route that does not declare a role fails CI.
- One shared, backend-defined contract for the frontend to mirror.
