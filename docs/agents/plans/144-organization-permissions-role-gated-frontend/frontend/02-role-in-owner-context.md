# Role in the owner context

Expose the caller's role for the current context through the existing app-level
`OwnerContextProvider`, so that bank pages and organization pages read the same value.

- In `OwnerContextProvider.jsx`, extend the pure `buildOwnerContextValue(route, orgState,
  refreshOrgs)` to add two fields:
  - `role`:
    - `ROLES.OWNER` when `context.kind === 'personal'`.
    - When `context.kind === 'organization'`, the `role` of
      `orgs.find(o => String(o.id) === String(context.orgId))`.
    - `null` when the list is still loading or the org is missing.
  - `refreshRole`: the same function as `refreshOrgs`.
- In `hooks/useOwnerContext.js`, add `role: null` and a no-op `refreshRole` to the frozen
  `DEFAULT_OWNER_CONTEXT`.
  - Optionally add a tiny `useCan(action)` hook beside it that returns
    `can(useOwnerContext().role, action)`, so components stay one-liners. If it is added, put
    it in `components/common/ownerContext/hooks/useCan.js`.
- Check whether `OrganizationsClient.rename` returns an updated org. If it does, the rename
  controller should keep calling `refreshOrgs()` so that the list, and therefore the role,
  stays fresh.
- Specs:
  - `buildOwnerContextValue` returns `owner` in personal context.
  - It returns the org's role in an organization context, for each of the three roles.
  - It returns `null` while the list is loading and when the org is unknown.
  - `refreshRole` is `refreshOrgs`.
  - `useCan` resolves through the context.

## Files to Change
- `frontend/assets/js/components/common/ownerContext/OwnerContextProvider.jsx`: add `role`
  and `refreshRole` to the context value.
- `frontend/assets/js/components/common/ownerContext/hooks/useOwnerContext.js`: update the
  default value.
- `frontend/assets/js/components/common/ownerContext/hooks/useCan.js`: new hook (optional;
  see above).
- `frontend/specs/assets/js/components/common/ownerContext/` (the matching `*Spec.js` files):
  new or updated specs.
