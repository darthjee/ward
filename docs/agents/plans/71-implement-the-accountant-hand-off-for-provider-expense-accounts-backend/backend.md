# Backend Plan: Implement the accountant hand-off for provider-expense accounts — backend

Main plan: [plan.md](plan.md)

## Overview
Implement the hand-off part of `docs/agents/specs/banking/accounts/provider-expense.md`
(*Business expenses for the accountant*, *Hand-off routes*, *Validation*, *Performance &
security*, *Edge cases* 1–11, *Required tests* for Transactions, Hand-off preview and Mark
sent / unsent), plus the extra decisions recorded in issue #71. The spec and the issue are the
source of truth. When they conflict or are unclear, raise it on the issue instead of deviating.

## Context
- #54 (merged) added the `provider_expense` account type, `bank_provider_expense_details`
  (`for_accountant` boolean default true, `provider_tax_id` varchar(32) nullable) and the
  migration `20261108120020-bank-create-provider-expense-details.ts`.
- All bank features live flat in `backend/src/bank/` (DTOs in `bank/dto/`). Resident controllers
  sit in `BankRoutesModule` and reach lazy services through `BankModuleLoader.services()`.
- `@OwnerScopedController('bank')` mounts `bank` and `orgs/:orgId/bank` and sets a class-level
  `@CachePolicy(CacheClass.UserScoped)`. Write routes add `@CachePolicy(CacheClass.Never)`.
- No bank code uses a pessimistic lock yet. The only DB transaction is
  `accountRepository.manager.transaction(...)` in `account.service.ts`.
- `account.service.ts` is at 293 of its 300-line limit. It and the account-type handlers must
  **not** be touched.

## Steps

- [01 — Add the `sent_to_accountant_at` column](backend/01-add-sent-to-accountant-at-column.md)
- [02 — Expose `sent_to_accountant_at` on transaction responses and clear it on a sign flip](backend/02-transaction-responses-and-sign-flip.md)
- [03 — Add the hand-off DTOs](backend/03-add-hand-off-dtos.md)
- [04 — Add the charges query and `AccountantService`](backend/04-add-accountant-query-and-service.md)
- [05 — Add `AccountantController` and wire the modules](backend/05-add-accountant-controller.md)
- [06 — e2e and integration specs](backend/06-e2e-and-integration-specs.md)
- [07 — Update the docs](backend/07-update-docs.md)

## CI Checks
- `backend` lint: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend` unit + e2e: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend` integration: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
- `backend` build: `docker-compose run --rm ward_tests yarn build`

Never run `yarn` on the host. Always go through `docker-compose run`.

## Notes
- **Reviews after implementation.** The issue adds endpoints, new user input and a response
  field, so run `security`, `data-access` and `cache` after the backend work. `cache` should
  confirm that all three routes stay out of Navi's warm-up (they are owner-scoped) and that
  `X-Skip-Cache` / `@CachePolicy` are correct: GET is `user-scoped`, the POSTs are `never`.
- **Preview cap.** The spec (not restated in the issue) caps the preview at 1000 charges and
  answers `400` ("narrow the range") above that. Query with `LIMIT 1001` and reject when 1001
  rows come back.
- **Repeated query parameter.** A repeated parameter arrives as an array, and `@IsIn` /
  `@IsString` reject it. No e2e covers this today, so add one.
- **400 body.** Thrown `BadRequestException('<message>')` strings are mapped by
  `core/http-exception.filter.ts` through `categoryCodeFor(400)`. Confirm in `core/error-codes.ts`
  that this gives `VALIDATION_FAILED`, and assert it in the e2e specs.
- **Lock testing.** The e2e harness has a fake `DataSource` and no real SQL. A unit spec asserts
  the `FOR UPDATE OF t` lock is requested. The real SQL (including `FOR UPDATE OF t` support on
  the MySQL version in use) is exercised by the integration spec. If the MySQL version rejects
  `OF t`, raise it on the issue rather than silently locking the joined tables.
- **Docs** (step 07) are architect-owned files, but the issue requires them in the same PR, as in
  #54.
