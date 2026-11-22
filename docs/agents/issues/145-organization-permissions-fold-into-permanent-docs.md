# Issue: Organization permissions: fold into permanent docs

## Description
Fold the *Organization permission system* epic ([#81](https://github.com/darthjee/ward/issues/81)) into the permanent docs, now that both of its sub-issues have merged: backend role enforcement ([#143](https://github.com/darthjee/ward/issues/143), PR #146) and the role-gated frontend ([#144](https://github.com/darthjee/ward/issues/144), PR #147). It follows the same pattern as earlier spec folds (e.g. [#126](https://github.com/darthjee/ward/issues/126)).

The plan folders of #143 and #144 were removed when they merged. The source of truth is the merged code, plus those plans in the git history of PRs #146 and #147.

## Problem
Many docs still say the roles are "stored but not enforced" or deferred to #81, which is now wrong:

- `docs/agents/modules/auth/organizations.md`: the summary bullet, the `role` row of the membership table, and the Roles section
- `docs/agents/backend/routes/auth.md`: the rename route says "any member (roles are not enforced)"
- `docs/agents/modules/bank.md`, `docs/agents/modules/bank/bills.md`, `docs/agents/modules/bank/provider-expense.md`
- `docs/agents/product.md` (two places) and `docs/agents/summary.md`
- `docs/agents/specs.md`: the Organizations row still lists #81 as an open epic

The new mechanisms are not documented anywhere except `architecture/caching.md`:

- backend: `@MinOrgRole`, the role on `OwnerContext`, and the coverage spec
- frontend: `can(role, action)`, `useCan`, the `forbidden` error kind, `PermissionDenied`

## Expected Behavior
After this issue, the permanent docs describe the enforced permission system completely. No doc refers to roles as unenforced or deferred to #81.

## Solution
- **`docs/agents/modules/auth/organizations.md`**
  - **Roles**: replace "stored, not enforced" with the enforced matrix (owner / admin / user; reads open to every member). Personal context counts as `owner`. Also record the member-management rules that [#82](https://github.com/darthjee/ward/issues/82) will apply: an admin manages only `user` members; the owner manages admins, transfers ownership and closes the organization.
  - **Owner-context mechanism**: the role on `OwnerContext`, the role-returning membership lookup port, and `@MinOrgRole` enforced by `OwnerContextGuard`. Also the closed-by-default coverage spec (`min-org-role.coverage.spec.ts`): every owner-scoped write route must declare a role. And the record-dependent check on payment-generated transactions.
  - **Security rules**: a non-member gets 404 and a member whose role is too low gets 403. The 404 check always runs first. The 403 body is uniform. The role comes only from the DB membership, never from input. There is no `is_admin` bypass.
  - **Edge cases**:
    - The role changes mid-session: the backend re-reads it on every request, and the frontend refreshes it on any 403.
    - A `user` cannot undo their own mistakes; authorship is deferred to [#95](https://github.com/darthjee/ward/issues/95).
    - **Known limitation:** a `user` still sees the Edit button on payment-generated transactions. The backend rejects the save with 403 and the UI shows the permission message. Record this in both `organizations.md` and `architecture/frontend.md`, and link the follow-up [#148](https://github.com/darthjee/ward/issues/148).
  - The `role` row of the membership table, and the summary bullet.
- **Bank docs** (`modules/bank.md` and the relevant sub-pages): the role each action needs. Remove the "not enforced until #81" notes in `bills.md` and `provider-expense.md`.
- **`docs/agents/backend/routes/auth.md`** and the bank route docs: the minimum role of each write route, and the 403 response.
- **`docs/agents/architecture/frontend.md`** (Owner context and API errors sections):
  - the `can(role, action)` helper and `useCan`
  - the `role` and `refreshRole` values of the owner context
  - the `PermissionEvents` 403 event and the role refresh it triggers
  - the `forbidden` error kind ("You don't have permission to do this", no Retry)
  - hidden controls for `user`
  - admin-only pages showing `PermissionDenied` when opened by URL
- **`product.md`, `summary.md`, `specs.md`**: update the role wording, and mark #81 as folded in the specs table.
- **Reviewer checks** (`.claude/agents/data-access.md`, `.claude/agents/security.md` and the related docs):
  - every owner-scoped write declares a minimum role
  - the role never comes from input
  - the non-member 404 comes before any 403
  - the 403 body is uniform
  - there is no `is_admin` bypass

**Closing the epic:** the PR closes epic [#81](https://github.com/darthjee/ward/issues/81) together with #145 (`Closes #145`, `Closes #81`), because this fold is the epic's last sub-issue.

**Out of scope:**

- any code change
- hiding the Edit button, which is left to #148

**Owning module:** docs, owned by the `architect` agent. This issue lands last in the epic.

## Benefits
The docs match the shipped behavior, so future work (#82 member management, #83 closing, #95 authorship) starts from accurate rules. The reviewer agents also enforce the role rules on every new endpoint.
