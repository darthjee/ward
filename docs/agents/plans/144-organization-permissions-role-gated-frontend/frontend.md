# Plan: Organization permissions: role-gated frontend

Issue: [144-organization-permissions-role-gated-frontend.md](../../issues/144-organization-permissions-role-gated-frontend.md)

## Overview

Hide, in the frontend, every action that the caller's organization role cannot perform, so
that a `user` member no longer clicks buttons that can only return 403. The backend (#143)
stays the real guard. This plan adds:

- a pure permission helper
- a shared role in the owner context
- a `forbidden` error kind that is wired to a role refresh
- gating in the bank and organization UI

## Context

The matrix, as enforced by the backend (`@MinOrgRole(ADMIN)` in `backend/src/`):

| Action | owner | admin | user |
|---|---|---|---|
| Create / edit transactions, bills, provider bills; pay; skip; mark sent/unsent | yes | yes | yes |
| Undo a payment; edit a payment-generated transaction | yes | yes | no |
| Create / edit / archive / unarchive accounts; rename organization | yes | yes | no |
| Delete anything (accounts, transactions, bills, provider bills) | yes | yes | no |

What the frontend already has:

- **Role values:** `'user' | 'admin' | 'owner'` (`backend/src/core/org-role.ts`). Personal
  context counts as `owner`.
- **Role source:** `role` is already in every organization payload. `OrgListController`
  loads `GET /orgs.json` once per session, and `useOwnerContext()` exposes it as `orgs`, along
  with `refreshOrgs()`.
- **403 body:** `{ error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode: 403 }`.
  Today `classifyError` (`components/resources/bank/common/bankErrors.js`) turns it into the
  `transient` kind ("Something went wrong" + Retry).

### Decisions

- **Role source:** the role is derived from the `orgs` list already in
  `OwnerContextProvider`, which is fetched once per session, so there is no second request
  per organization. A refresh re-runs `refreshOrgs()`.
  - The provider exposes `role` (`'owner'` in personal context; the org's `role` in an
    organization context; `null` while the list is loading or when the org is not in the
    list) and `refreshRole()`, an alias of `refreshOrgs`.
- **Unknown role:** a `null` role is treated as "not yet known".
  - `can(null, adminAction)` returns `false`, so admin-only controls stay hidden until the
    role is known.
  - Admin-only pages render nothing (or their existing loading state) while the role is
    `null`, so a page does not flash the permission message.
- **Action names:** the actions are string constants exported from the helper module, and
  components never compare roles inline:
  - `ACTIONS.WRITE`: transactions, bills, provider bills, pay, skip, mark sent/unsent. Every
    role.
  - `ACTIONS.UNDO_PAYMENT`: admin and above.
  - `ACTIONS.EDIT_PAYMENT_TRANSACTION`: admin and above.
  - `ACTIONS.MANAGE_ACCOUNTS`: create, edit, archive, unarchive. Admin and above.
  - `ACTIONS.RENAME_ORGANIZATION`: admin and above.
  - `ACTIONS.DELETE`: admin and above.
- **403 to refresh wiring:** `ApiClient` emits a `forbidden` event on a new
  `client/PermissionEvents.js` bus whenever a response is 403. This follows the
  `AuthEvents` / `LoginModalEvents` pattern. `OwnerContextProvider` subscribes and calls
  `refreshOrgs()`. Every one of the roughly 11 `classifyError` call sites, plus the
  organization rename, gets the refresh without per-controller changes, and `classifyError`
  stays pure.
- **Permission message:** the text is exactly "You don't have permission to do this". It
  lives in one shared component, `components/common/PermissionDenied.jsx`, and in the
  `forbidden` branch of `BankErrorAlert`. Both read one exported constant.

## Steps

- [01 — Permission helper](frontend/01-permission-helper.md)
- [02 — Role in the owner context](frontend/02-role-in-owner-context.md)
- [03 — 403 handling and role refresh](frontend/03-forbidden-handling.md)
- [04 — Hide forbidden controls](frontend/04-hide-forbidden-controls.md)
- [05 — Admin-only pages by URL](frontend/05-admin-only-pages.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- **Payment-generated transaction edit cannot be hidden.** Ledger rows
  (`backend/src/bank/transaction-response.ts`) carry no "payment-generated" flag, so the
  frontend cannot tell those rows apart.
  - The Edit button stays visible for a `user`, and a save that the backend rejects with 403
    falls back to the permission message (step 03).
  - `ACTIONS.EDIT_PAYMENT_TRANSACTION` is still defined in the helper so that a later
    backend flag can gate the button with a one-line change.
  - Exposing such a flag is a backend follow-up and is out of scope here.
- **Bill delete:** `BillsClient.deleteBill` has no UI caller, so there is nothing to gate for
  bill delete beyond provider bills.
- **Ungated UI:** the bank menu, the "Add" shortcuts, Pay/Skip and mark sent/unsent are
  user-level and stay as they are.
- **Leave `redirectIfForbidden` alone.** `utils/routing/redirects.js`'s
  `redirectIfForbidden` belongs to the admin pages and does not apply here.
- **Member-management UI is out of scope** (#82).
