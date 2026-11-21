# Declare roles on bank write routes and the per-role e2e matrix

Add `@MinOrgRole(...)` to every bank write handler, exactly per the issue table:

- `accounts.controller.ts`: `POST accounts.json`, `PATCH :accountId`, `DELETE :accountId`,
  `archive` and `unarchive` → `admin`.
- `transactions.controller.ts`: `POST` → `user`; `PATCH` (`update`) → `user`; `DELETE`
  (`remove`) → `admin`.
- `bills.controller.ts`: `POST`, `PATCH` → `user`; `DELETE` → `admin`.
- `provider-bills.controller.ts`: `POST accounts/:accountId/provider-bills.json`,
  `PATCH provider-bills/:id.json` → `user`; `DELETE` → `admin`.
- `bill-payments.controller.ts`: both `POST …/payment.json` → `user`; both
  `DELETE …/payment.json` → `admin`.
- `provider-bill-payments.controller.ts`: `POST` → `user`; `DELETE` → `admin`.
- `accountant.controller.ts`: `mark-sent` and `mark-unsent` → `user`.

Reads get no declaration. `settings.controller.ts` and `calendar.controller.ts` stay unchanged.
Add an `@throws` 403 line to the JSDoc of each `admin` handler, where those docs list errors.

E2e matrix, in a new `bank/tests/org-roles.e2e-spec.ts` (split per controller if it grows past
the readable size):

- Use the step 03 seeding helper to add memberships on `ALICE_ORG` for three more users: an
  `owner`, an `admin` and a `user` (for example ids `20`, `21`, `22`). Use a member of `BOB_ORG`
  only as the non-member.
- Drive the matrix from a table with one row per route: `{ method, path(builder), minRole,
  setup }`, where `setup` creates the needed account, bill, provider bill, transaction or
  payment as the org owner.
- For each route and each of `owner`, `admin`, `user` and non-member, under
  `/orgs/:orgId/bank/...`:
  - a role at or above the minimum → 2xx;
  - a role below it → 403 with `UNIFORM_403 = { error: { code: 'FORBIDDEN', message:
    'Forbidden' }, statusCode: 403 }` (match without `timestamp`, as `UNIFORM_404` does);
  - a non-member → `UNIFORM_404`.
- Also assert that the 403 leaves the data untouched (for example, a `user`'s `DELETE` keeps
  the account).
- Add one personal-context case per `admin` route, to show that personal context is unaffected.
- Add a malformed `:orgId` case, to show that the 404 comes before the role check.
- Put `UNIFORM_403` next to `UNIFORM_404` in the shared support (`bank/tests/support/
  owner-matrix.ts` or wherever `UNIFORM_404` lives).

## Files to Change
- `backend/src/bank/accounts.controller.ts` — `@MinOrgRole('admin')` on 5 writes.
- `backend/src/bank/transactions.controller.ts` — `user`/`user`/`admin`.
- `backend/src/bank/bills.controller.ts` — `user`/`user`/`admin`.
- `backend/src/bank/provider-bills.controller.ts` — `user`/`user`/`admin`.
- `backend/src/bank/bill-payments.controller.ts` — `user` on POSTs, `admin` on DELETEs.
- `backend/src/bank/provider-bill-payments.controller.ts` — `user` on POST, `admin` on DELETE.
- `backend/src/bank/accountant.controller.ts` — `user` on mark-sent and mark-unsent.
- `backend/src/bank/tests/org-roles.e2e-spec.ts` — new per-role matrix.
- `backend/src/bank/tests/support/owner-matrix.ts` — `UNIFORM_403` and role fixtures.
