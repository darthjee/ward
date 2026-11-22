# Fix auth test type errors
Fix the 5 errors in the auth test sources. None of them change test behaviour.

- `admin.controller.review.e2e-spec.ts:234` (TS2345): the `describe.each([[username, status], ...])` callback takes one parameter while each row has two. Change the callback to `(username, _status) => {` (the `^_` prefix is already allowed by `@typescript-eslint/no-unused-vars`).
- `authorization-request.service.test-support.ts:34-35` (TS7022/TS7024): `queryBuilderMock`'s `builder` references itself untyped. Export `type QueryBuilderMock = { update: jest.Mock; set: jest.Mock; where: jest.Mock; execute: jest.Mock }`, use it as the function return type and annotate `const builder: QueryBuilderMock = { ... }`.
- `support/in-memory-repo.ts:129` (TS7022): in `createQueryBuilder`, add a file-local `interface FakeUpdateQueryBuilder { update(): FakeUpdateQueryBuilder; set(payload: Record<string, unknown>): FakeUpdateQueryBuilder; where(sql: string, params: Record<string, unknown>): FakeUpdateQueryBuilder; execute(): Promise<{ affected: number }>; }`, annotate `const builder: FakeUpdateQueryBuilder`, and drop the `: typeof builder` return annotations.
- `support/in-memory-repo.ts:150` (TS2322): replace `(row as never)[key] = ...` with `Object.assign(row, { [key]: typeof value === 'function' ? new Date() : value });`.

## Files to Change
- `backend/src/auth/tests/admin.controller.review.e2e-spec.ts` — two-arg `describe.each` callback
- `backend/src/auth/tests/authorization-request.service.test-support.ts` — `QueryBuilderMock` type
- `backend/src/auth/tests/support/in-memory-repo.ts` — `FakeUpdateQueryBuilder` interface, `Object.assign` write
