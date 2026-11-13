# E2E specs for the header

Assert the header on representative writes, through the real interceptor stack.

## Bank

Model the bank tests on `backend/src/bank/tests/bill-payments.e2e-spec.ts`. Its
`CONTEXTS = [['Personal', null], ['organization', ALICE_ORG]]` loop and the `base(orgId)` helper
fit here directly.

- **Payment** (POST `accounts/:accountId/occurrences/:dueDate/payment.json`):
  - expect `res.headers['x-cache-invalidate']` to equal `base(orgId)`, that is `/bank` or
    `/orgs/3/bank`;
  - a request rejected with 4xx or 404 has **no** `x-cache-invalidate` header.
- **Other writes:** add one assertion per remaining owner-scoped controller, in its existing e2e
  spec:
  - account archive in `accounts.e2e-spec.ts`;
  - transaction create in `transactions.e2e-spec.ts`;
  - bill create in `bills.e2e-spec.ts`;
  - mark-sent in `accountant.e2e-spec.ts`.
- **Organization isolation:** a write under `ALICE_ORG` never emits a path that contains
  `BOB_ORG` or `/bank` alone.

## Organizations

Use `backend/src/auth/tests/organization.controller.*.e2e-spec.ts` and its support helpers.

- `createOrganization` responds with `x-cache-invalidate: /orgs.json`.
- `renameOrganization` responds with `x-cache-invalidate: /orgs.json, /orgs/<id>.json`.
- A rename of a non-member org (404) carries no header.

## Auth

In `backend/src/auth/tests/auth.controller.skip-cache.e2e-spec.ts`, assert that a successful login
or register carries no `x-cache-invalidate`.

## Files to Change

- `backend/src/bank/tests/bill-payments.e2e-spec.ts`: payment and undo header assertions, both
  contexts.
- `backend/src/bank/tests/accounts.e2e-spec.ts`, `transactions.e2e-spec.ts`, `bills.e2e-spec.ts`,
  `accountant.e2e-spec.ts`: one representative header assertion each.
- `backend/src/auth/tests/organization.controller.create.e2e-spec.ts` and the rename spec (or
  `read.e2e-spec.ts`, wherever rename is exercised): the org header assertions.
- `backend/src/auth/tests/auth.controller.skip-cache.e2e-spec.ts`: the no-header assertion.
