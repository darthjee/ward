# Bank e2e harness and owner-context / lazy-loading e2e specs

Cover the Required tests (*Backend*) of `regular.md` and `transactions.md` end to end, together
with the record-level tests that moved here from #46 (`auth/organizations.md`).

## Harness (`bank/tests/support/build-bank-test-app.ts`)

- Use `NestFactory.create`, not `Test.createTestingModule`, because `LazyModuleLoader` needs a
  real app. Follow `core/tests/owner-scoped.module.e2e-spec.ts`.
- **Fake data source:** a `@Global()` test module provides `getDataSourceToken()` as a fake.
  - `getRepository(entity)` returns in-memory repositories built with `createInMemoryRepo`.
  - It has `entityMetadatas: []`, `options: { type: 'mysql' }` and a `transaction` passthrough.
  - This way the repositories that the lazy `BankModule`'s `forFeature` creates resolve to the
    fakes.
- **Fake `LedgerQuery`:** override it with an in-memory implementation that computes the same
  envelope in TypeScript, because the in-memory repository cannot run window functions. The
  real SQL is covered by the integration spec from step 05.
- **Identities:** a stub user guard, or the real JWT login from the auth harness if combining
  them is simple, plus a fake `ORGANIZATION_MEMBERSHIP_LOOKUP` and `x-test-admin` for the
  global-admin case. Wire in `OwnerContextGuard`, `CachePolicyInterceptor`,
  `HttpExceptionFilter`, the global `ValidationPipe` and `BankRoutesModule`.
- Set up once per file, with a 30 s hook timeout, as the organization specs do after #46.

## Specs

### Owner-context matrix

On **every** account route, transaction route and `settings.json`:

- both prefixes work, `/bank/...` and `/orgs/:orgId/bank/...`;
- an account created on a personal route belongs to the user, and one created on an
  organization route belongs to the organization;
- each of these answers 404 with a **byte-identical** body (apart from the timestamp):
  - unknown and non-numeric ids;
  - another user's personal account;
  - an organization account on a personal route, and the reverse;
  - another organization's account;
  - a non-member `:orgId`;
  - a global admin who is not a member.

### Ownership rules

- The personal list never includes organization accounts, even those of the user's own
  organizations.
- A global admin gets none of another user's personal data.
- `user_id` and `organization_id` are absent from every response, and in every body they are
  rejected with a 400. The same applies to `accountId`, `type` on PATCH and computed fields.

### Validation and conflicts

- The create defaults and every length limit.
- Unknown fields get a 400.
- Every 409 path: name clash, archived edits, currency lock, delete with transactions,
  unarchive clash, and transaction writes on an archived account.

### Ledger envelope

- `opening` is set only on the last page.
- An out-of-range page returns an empty list with the same metadata.
- `page=0`, `page=-1` and `page=abc` get a 400.
- Amounts are decimal strings in the currency's exponent.

### Caching

- GET routes send `X-Skip-Cache` and the `user-scoped` `Cache-Control`.
- Writes are `never`.

### Lazy loading

- `BankModule` is not instantiated before the first bank request, for example by checking a
  constructor counter on a lazy provider or by inspecting `ModulesContainer`.
- After several requests on different bank routes, it has been instantiated exactly once.

## Files to Change

- `backend/src/bank/tests/support/build-bank-test-app.ts` — new: the harness.
- `backend/src/bank/tests/support/in-memory-ledger.query.ts` — new: the fake `LedgerQuery`.
- `backend/src/bank/tests/accounts.e2e-spec.ts` — new: account routes and the owner matrix.
- `backend/src/bank/tests/transactions.e2e-spec.ts` — new: transaction routes and the ledger envelope.
- `backend/src/bank/tests/settings.e2e-spec.ts` — new.
- `backend/src/bank/tests/bank-lazy-loading.e2e-spec.ts` — new.
