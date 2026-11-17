# Write the API specs

Write both API files, each with a cache-class table (route → `@CachePolicy` class, header,
invalidation) settled with the `cache` agent in step 01: GETs `user-scoped` (inherited from
`OwnerScopedController`, `X-Cache-Allow`), writes `never` (`X-Skip-Cache`) with
`InvalidatesOwner()` clearing `/bank` or `/orgs/:id/bank`; Navi warms none
(`docs/agents/cache-warmer.md`). `<base>` is `/bank` or `/orgs/:orgId/bank`.

**`api/provider-bills.md`**

- Nested `GET/POST <base>/accounts/:accountId/provider-bills.json?kind=&page=` — `:accountId`
  must be an owned `provider_expense` (archived allowed for list, `409 ACCOUNT_ARCHIVED` on
  create); 50 per page; ordering recurring first by `description`, then one-offs by newest
  `due_date`; unknown `kind` value → empty list.
- Top-level `GET/PATCH/DELETE <base>/provider-bills/:id.json` — owner-scoped, archived provider
  → `404`; PATCH merged-state validation; DELETE `409 PROVIDER_BILL_PAID` when any payment is
  `paid`, else cascades skipped rows.
- Request / response bodies (snake_case fields, `kind`, both column groups).
- Error codes table: `PROVIDER_BILL_KIND_LOCKED`, `PROVIDER_BILL_PROVIDER_LOCKED`,
  `PROVIDER_BILL_NAME_TAKEN`, `PROVIDER_BILL_PAID`, `PROVIDER_BILL_LIMIT` (all `409`), plus
  `400` validation, `404`, `422` (`ACCOUNT_NOT_FOUND` / `CURRENCY_MISMATCH`),
  `PROVIDER_HAS_MULTIPLE_BILLS` (transition, on the provider-expense PATCH).
- `bills.json` compatibility projection: `kind = 'one_off'` implicitly, creates one-offs only, a
  recurring field → `400`; payload shape changes limited to `kind` and `amount` →
  `expected_amount` (state whether `amount` stays as an alias during the transition — decide
  with the `frontend`-facing compatibility goal in mind and record it).
- Reference; Required tests (`provider-bills.e2e-spec.ts` over both base paths,
  `bills.e2e-spec.ts` extension, cache-header assertions).

**`api/payments.md`**

- `GET <base>/provider-bills/:id/bill-payments.json?page=`,
  `POST/DELETE <base>/provider-bills/:id/occurrences/:dueDate/payment.json` — both kinds,
  `:dueDate` validated per bill, same three transactions and one `bank_bill_payments` row keyed
  by `(provider_bill_id, due_date)`; `409 OCCURRENCE_ALREADY_PAID` per bill; two bills of one
  provider on the same date both succeed.
- Account-level routes: debt only after #125; transition aliases for providers (single
  recurring bill, else `404`).
- Occurrence payload: `source_account` unchanged, new `source_bill: { id, description } | null`
  (set for provider bills and one-off bills, `null` for debt); sort tie-breaker on bill id
  before account id.
- `OccurrenceKind` staging: `provider` kept through #123/#124, frontend accepts both in #124,
  renamed to `provider_bill` in #125.
- Off-schedule computed per bill against that bill's own schedule.
- `overdue.json` lists each recurring bill's unpaid occurrences independently.
- Reference; Required tests (`bill-payment.writer.spec.ts`, `calendar-units.spec.ts`,
  `occurrences.spec.ts`, `bill-history.spec.ts`, `bill-payments.e2e-spec.ts`,
  `calendar.e2e-spec.ts`, `accountant.e2e-spec.ts` unchanged).

## Files to Change

- `docs/agents/specs/split-provider/api/provider-bills.md` — new.
- `docs/agents/specs/split-provider/api/payments.md` — new.
