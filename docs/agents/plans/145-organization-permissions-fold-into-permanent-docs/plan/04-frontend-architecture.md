# Frontend architecture doc
Extend `docs/agents/architecture/frontend.md` with the role-gated frontend (#144), using the
frontend facts in [plan.md](../plan.md#context).

- **Owner context (organizations)** — new bullets (or a "Permissions" sub-list):
  - **Role**: `role` and `refreshRole` on the owner context; where the role comes from
    (personal → `owner`, org → `GET /orgs.json` entry, `null` while loading); no separate
    request; `refreshRole` = the org-list refetch.
  - **`can(role, action)`** (`utils/permissions/orgPermissions.js`): `ROLES`, `ACTIONS` with
    their minimum role (table), fail-closed on unknown/`null`; **`useCan(action)`**;
    `useManageAccountsGate`.
  - **Role refresh on 403**: `PermissionEvents` (`permission:forbidden`) emitted by `ApiClient`
    on any 403, listened by `forbiddenRefreshEffect` mounted in the provider (one refresh per
    burst), so a role change mid-session is picked up.
  - **Hidden controls for `user`** (list from plan.md); admin/owner see everything.
  - **`PermissionDenied`** for admin-only pages opened by URL (bank account New/Edit for all four
    account types, org rename page); renders nothing while the role is unknown.
  - **Known limitation**: Edit stays visible on payment-generated transactions for `user`
    (`EDIT_PAYMENT_TRANSACTION` unused); backend 403 + permission message; follow-up #148.
- **API errors** — add: a 403 also fires `PermissionEvents.emitForbidden()`; the bank
  `classifyError` `forbidden` kind ("You don't have permission to do this", no Retry, unlike
  `transient`); `PERMISSION_DENIED_MESSAGE` reused by the org rename form.
- **Directory layout** — add `utils/permissions/` and `client/PermissionEvents.js` if the
  layout lists that level of detail.

## Files to Change
- `docs/agents/architecture/frontend.md` — Owner context, API errors, directory layout
