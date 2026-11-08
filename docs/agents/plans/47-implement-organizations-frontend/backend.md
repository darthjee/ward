# Backend Plan: Implement organizations — frontend

Main plan: [plan.md](plan.md)

## Shared contracts

`POST /auth/status.json`:

| State | Body (exact) |
|---|---|
| Logged in (approved) | `{ "loggedIn": true, "isAdmin": <boolean>, "userId": <number> }` |
| Pending | `{ "loggedIn": false, "isAdmin": false, "status": "pending" }` — unchanged |
| Denied / unknown / revoked / expired token | `{ "loggedIn": false, "isAdmin": false }` — unchanged, byte-for-byte |

`userId` = `user.id`; present only when logged in. Cache class stays `never`. HTTP status unchanged
(201).

## Implementation Steps

### Step 1 — Return `userId` in the logged-in status answer

In `backend/src/auth/session-status.service.ts`:

- add `userId?: number` to the `AuthStatus` interface and update its JSDoc (the logged-in answer
  carries `loggedIn` / `isAdmin` / `userId`; every other answer is unchanged);
- in `#statusFor`, change the approved branch to
  `return { loggedIn: true, isAdmin: user.isAdmin, userId: user.id };` (key order
  `loggedIn, isAdmin, userId`);
- update the `status()` method JSDoc.

In `backend/src/auth/auth.controller.ts`, update the `status` handler's `@returns` JSDoc to mention
`userId` on the logged-in answer. Do not touch its cache policy or decorators.

### Step 2 — Specs

- `backend/src/auth/tests/session-status.service.spec.ts`: the approved and admin cases expect
  `userId: 1`; the pending case additionally asserts `not.toHaveProperty('userId')`; the denied /
  unknown / expired / rotated cases keep asserting `ANONYMOUS` (and the denied-equals-unknown
  `JSON.stringify` check) — add `not.toHaveProperty('userId')` where useful.
- `backend/src/auth/tests/auth.controller.spec.ts` (`POST /auth/status.json` block): include
  `userId` in the logged-in mock and pass-through expectation.
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts` (`status check` block and the
  `by account status` block): the approved/admin `toEqual` answers include
  `userId: ctx.userRepo.rows[0].id` (or the id of the user under test); check every exact
  `toEqual` on an approved answer in that file. Logged-out answers stay as they are.
- `auth.controller.user-status.e2e-spec.ts` and `auth.controller.skip-cache.e2e-spec.ts` should pass
  unchanged; run them to prove denied/anonymous bodies and headers are unchanged.

## Files to Change

- `backend/src/auth/session-status.service.ts` — `AuthStatus.userId?`, approved branch, JSDoc.
- `backend/src/auth/auth.controller.ts` — `status` JSDoc only.
- `backend/src/auth/tests/session-status.service.spec.ts` — expectations.
- `backend/src/auth/tests/auth.controller.spec.ts` — mock and expectation.
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts` — expectations.

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)

## Notes

- Documentation of the status response (`docs/agents/...`) is updated by the architect, not here.
- The 200-vs-201 doc mismatch predates this issue; do not change the HTTP status.
