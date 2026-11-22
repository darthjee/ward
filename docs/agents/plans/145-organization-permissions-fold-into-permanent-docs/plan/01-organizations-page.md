# Organizations page
Rewrite `docs/agents/modules/auth/organizations.md` so it describes the enforced permission
system. Use the backend/frontend facts in [plan.md](../plan.md#context).

- **Summary bullet** — roles are **enforced**: reads open to every member, everyday writes for
  `user`, destructive and structural writes for `admin`, owner = creator; personal context
  counts as `owner`.
- **Membership table** — the `role` row: enforced, see [Roles](#roles).
- **Roles section** — replace "stored, not enforced / deferred to #81" with:
  - the role matrix (owner / admin / user), stated as action classes with a link to the per-route
    table in [backend/routes/bank.md](../../backend/routes/bank.md) and the rename rule (admin+);
  - personal context counts as `owner`;
  - no action is owner-only today;
  - target member-management rules for #82/#83: an admin manages only `user` members; the owner
    manages admins, transfers ownership and closes the organization;
  - keep the existing bullets on global `is_admin`, active organization only, personal data.
- **Membership and ownership** — "create and rename (any member)" → rename needs `admin`.
- **Owner-context mechanism** — add: the `role` on the organization variant of `OwnerContext`,
  `ownerRole()`, `OwnerScope`; the port now returns the role (`findRole`, replace the
  `isMember` / `findMembership` wording to match the code); `@MinOrgRole()` enforced by
  `OwnerContextGuard` after the 404 resolve; `core/org-role.ts`; the closed-by-default
  `min-org-role.coverage.spec.ts` (every owner-scoped non-GET/HEAD route must declare a valid
  role, shared route discovery); the record-dependent payment-generated check
  (`#assertMayEdit`, `PaymentGeneratedQuery`, fails closed).
- **Security rules** — non-member → 404, member with too low a role → 403; the 404 check always
  runs first; uniform 403 body (quote it); the role comes only from the DB membership, re-read on
  every request, never from input; no `is_admin` bypass. Extend the "No client-supplied owner or
  role" bullet.
- **`data-access` checks** subsection — add the role checks (see step 06 for the list).
- **Edge cases** — add: role changed mid-session (backend re-reads each request; frontend
  refreshes the role on any 403); a `user` cannot undo their own mistakes (delete/undo need
  admin), authorship deferred to [#95](https://github.com/darthjee/ward/issues/95); **Known
  limitation**: a `user` still sees Edit on payment-generated transactions, the backend rejects
  the save with 403 and the UI shows the permission message — follow-up
  [#148](https://github.com/darthjee/ward/issues/148).
- **Deferred** — drop the #81 line (add #148). **Header** — mention #81 / #143 / #144 as the
  issues that built the permission system.
- **Differences from the original spec** — update the port name list (`findRole`), add
  `@MinOrgRole`.

## Files to Change
- `docs/agents/modules/auth/organizations.md` — all sections above
