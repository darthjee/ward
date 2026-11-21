# Issue: Organization permissions: role-gated frontend

## Description
Gate the frontend by the caller's organization role. Part of the *Organization permission system* epic (#81). It mirrors the backend role enforcement shipped in #143, which is the real guard (403).

### Matrix to mirror (as enforced by the backend)

| Action | owner | admin | user |
|---|---|---|---|
| Create / edit transactions, bills, provider bills; pay; mark sent/unsent to accountant | ✅ | ✅ | ✅ |
| Undo a payment; edit a payment-generated transaction | ✅ | ✅ | ❌ |
| Create / edit / archive / unarchive accounts; rename organization | ✅ | ✅ | ❌ |
| Delete anything (accounts, transactions, bills, provider bills) | ✅ | ✅ | ❌ |

There is no bank-settings write action: `settings.json` is a read-only GET feeding the account forms, so nothing about it is gated.

### Out of scope
- Backend enforcement (#143, done).
- Member-management UI (#82).

## Problem
Since #143, a `user` member gets a 403 for actions the frontend still offers, so they click buttons that can only fail.

## Expected Behavior
- **Hide forbidden actions**: in an organization context, controls the caller's role can't use are not rendered (links, buttons, menu items). `owner` and `admin` see everything.
- **Personal context** counts as `owner`: nothing is hidden there.
- **Admin-only pages reached by URL** (New account, Edit account, Rename organization) render a plain "You don't have permission to do this" message instead of the form.
- **403 fallback**: if a 403 still happens (e.g. the role changed after it was loaded), show "You don't have permission to do this" instead of a generic error, and re-fetch the caller's role so stale controls disappear.

## Solution
- **Role source**: when entering an organization context, fetch the organization once and share its `role` through an app-level context that bank pages and the organization pages read. Personal context resolves to `owner`.
- **One helper**: a small `can(role, action)` helper mirrors the matrix. Components ask the helper and never compare roles inline.
- **403 handling**: classify the backend's 403 (`{ error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode: 403 }`) as its own error kind; `BankErrorAlert` renders the permission message, and the shared role is refreshed.

### Testing
Jasmine specs: `can()` matches the matrix for every role and action; forbidden controls are not rendered per role; personal context hides nothing; admin-only pages show the permission message for a `user`; a 403 shows the permission message and triggers a role refresh.

### Owning module
Frontend (bank pages, organization rename, the role context and helper). Agent: `frontend`.

## Benefits
Users only see actions they can perform, and the frontend stays consistent with the backend permission matrix.
