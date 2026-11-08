# Backend Plan: Implement investment accounts — backend

Main plan: [plan.md](plan.md)

## Overview
Implement `type: "investment"` on the generic account routes, following
`docs/agents/specs/banking/accounts/investment.md` (source of truth) and the decisions recorded
in the issue. Everything reuses the #50 handler registry (`backend/src/bank/account-types/`):
registering the handler is what makes `type=investment` stop answering 400. No new routes, no
controller change, nothing for Navi (all GET routes are already `user-scoped` with
`X-Skip-Cache`; writes are `never`).

## Context
- `AccountTypeHandler` today: `type`, `carriesLedger`, `validateCreate(nested, ctx)`,
  `validateUpdate(nested, stored, ctx)`, `loadDetails(ids, manager)`,
  `saveDetails(account, prepared, manager)`, `serialize(details, account)`.
- `AccountTypeRegistry.assertNoForeignNested` already rejects another type's nested key once
  the type is registered, so `investment` on regular/debt (and `debt` on investment) → 400 for
  free.
- Archived accounts: `AccountService.patch` already returns 409 when any field other than
  `name` is present (including `investment` and `opening_balance`), after the ValidationPipe
  (format errors stay 400). Nothing new needed.
- `account.service.ts` is at 292 lines (lint `max-lines` 300): the service change must stay at
  about one line.
- Issue decisions: paired `yield_rate` ↔ `yield_period` rule checked on stored details merged
  with the request; `maturity_date` any real `YYYY-MM-DD` (no today+1 bound, `2026-02-30` →
  400); `liquidity_days` integer 0..2147483647; `yield_rate` serialized without trailing zeros;
  any `investment` field on an archived account → 409.

## Steps

- [01 — Entity and migration](backend/01-entity-and-migration.md)
- [02 — Nested investment DTO and validators](backend/02-investment-dto.md)
- [03 — Handler contract hook and InvestmentAccountHandler](backend/03-investment-handler.md)
- [04 — Test harness and stale fixtures](backend/04-test-harness.md)
- [05 — Required tests](backend/05-required-tests.md)
- [06 — Documentation](backend/06-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job:
  `backend_integration`, needs MySQL)

## Notes
- Never run `yarn` on the host; always through `docker-compose run`.
- Step 06 edits files under `docs/agents/`, which the `architect` owns. The backend agent may
  draft them, or the architect does them after steps 01–05 (as in #50).
- After implementation, run the `security`, `data-access` and `cache` reviews (new accepted
  input and response fields on existing endpoints); `cache` is expected to confirm no Navi change.
- If a spec point turns out unclear, raise it on the issue instead of deviating.
