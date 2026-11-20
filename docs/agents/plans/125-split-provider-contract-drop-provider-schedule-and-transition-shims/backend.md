# Backend Plan: Split provider: contract, drop provider schedule and transition shims

Main plan: [plan.md](plan.md)

## Shared contracts

What the backend must produce:

- **Provider-expense response.** `provider_expense` is
  `{ for_accountant: boolean, provider_tax_id: string | null }` only. The seven schedule keys
  are absent.
- **Create / PATCH.** A schedule key nested in `provider_expense` (for example
  `provider_expense.due_day`) is a `400`, through `@StrictBody()` with `forbidNonWhitelisted` and
  `@ValidateNested`. The same applies to any key not allowed there.
- **Account-level routes for providers.** `GET accounts/:id/bill-payments.json` and
  `POST`/`DELETE accounts/:id/occurrences/:dueDate/payment.json` answer the uniform owner-scoped
  `404` (`ownerNotFound()`) for a `provider_expense` account. It must be identical to the
  unknown/foreign-account `404`. Debts are unchanged.
- **Occurrence kind.** `OccurrenceKind = 'debt' | 'provider_bill' | 'bill'`. Recurring
  provider-bill occurrences carry `provider_bill` and keep `source_bill`.
- **Error code.** `PROVIDER_HAS_MULTIPLE_BILLS` is removed everywhere.
- **Provider bill list.** `GET accounts/:id/provider-bills.json?kind=recurring&page=1` is
  unchanged. The frontend now relies on its `kind` filter and on `pagination.total_count`.
- **Down backfill rule.** Only `kind = 'recurring'` provider bills count, since provider bills
  have no archived flag. With exactly one, copy its values; with zero or several, use `NULL`.

## Steps

- [01 — Contract migration and entity](backend/01-contract-migration.md)
- [02 — Provider-expense details: drop schedule, write-through and 409](backend/02-provider-expense-details.md)
- [03 — Remove compatibility aliases and the provider branch of billSourceOf](backend/03-remove-aliases.md)
- [04 — Rename OccurrenceKind provider to provider_bill](backend/04-occurrence-kind-rename.md)

## CI Checks

- `backend` unit and e2e: `docker-compose run --rm ward_tests yarn coverage` (CI job:
  `backend_tests`)
- `backend` integration: `docker-compose run --rm ward_tests yarn test:integration` (CI job:
  `backend_integration`)
- `backend` lint: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend` build: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)
- Dev DB round-trip: `docker-compose run --rm ward_app yarn migration:run`, then
  `yarn migration:revert`, then `yarn migration:run` again.

## Notes

- **Merge gate.** Do not merge until #124, #131, #132 and #133 are deployed. Implementation can
  proceed now.
- **`accountant.e2e-spec.ts` stays unchanged and green.** It only uses `for_accountant` and
  `provider_tax_id`.
- **Rollback order.** Run `down` first, then revert the code; the PR states this. The rollout
  window of `500`s on provider routes while the old instance is still serving is accepted.
- **Production-dump dry run.** The maintainer runs it. The PR records aggregate counts only:
  - providers whose columns disagree with their single recurring bill (expected `0`);
  - the payment count, which `up` leaves unchanged;
  - the `down` round-trip result.
- **"Non-archived" decision.** The issue says "non-archived recurring", but provider bills have
  no `archived_at`. The rule therefore counts every recurring bill. The architect records this in
  the split-provider spec.
- Keep `rescaleProviderBills` on a currency change. Only the write-through goes away.
