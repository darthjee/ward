# Split provider — Security, ownership and performance

Data sensitivity and ownership, and the performance and security decisions, confirmed (with
additions) after review. Read by [#121](https://github.com/darthjee/ward/issues/121),
[#122](https://github.com/darthjee/ward/issues/122) and
[#123](https://github.com/darthjee/ward/issues/123). Back to the [README](README.md).

## Data sensitivity and ownership (decided)

- Provider bills are **personal financial data**. They inherit their owner through the provider
  account; a bill never stores an owner, and an owner / organization id is never taken from a
  request body.
- **Personal context** (`/bank`): owner only. The global admin gets **no** access.
- **Organization context** (`/orgs/:orgId/bank`): every member has full read and write access,
  because roles are stored but not enforced until
  [#81](https://github.com/darthjee/ward/issues/81)
  ([organizations](https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth/organizations.md)).
  No new role logic is added; the existing bank guards are reused. When #81 lands it applies to
  provider bills like any bank write.
- A non-member and a global admin who is not a member both get the uniform `404` from
  `OwnerContextGuard`. Roles arriving with #81 need no data migration.
- All provider-bill routes (nested, top-level, payment, history) are mounted under
  `@OwnerScopedController` and take bodies only through `@StrictBody()` (an owner field in a body
  → `400`). The same data-access checks apply to `bank_provider_bills` and to
  `bank_bill_payments.provider_bill_id`; neither needs an owner column.
- **Order of checks**: every `409` (`PROVIDER_HAS_MULTIPLE_BILLS`, `PROVIDER_BILL_NAME_TAKEN`,
  `PROVIDER_BILL_PAID`, …) is returned only **after** the owner-scoped resolve succeeds, so no
  code leaks the existence of a foreign record. The uniform `404` also covers a non-numeric id
  and a malformed `:dueDate`.
- Every verb on every per-bill route (read, update, delete, payment, history) performs the owner
  check, on both base paths.

## Exposure

- Full `ProviderBill` fields appear only on the provider-bills routes.
- Occurrence payloads carry `source_bill: { id, description }` of the caller's own bill and
  **never** `notes` (explicit response mapper, not entity spread).
- The provider-expense details payload: schedule fields are read from the single recurring bill
  and are `null` with zero or several (see [migration.md](migration.md)).

## Decisions (confirmed unless marked)

| Concern | Decision |
|---|---|
| Resolution | `ProviderBillResolver` reuses the `BillService.findOwned` pattern: load the bill, then its provider with `accountOwnerWhere(owner)`, `type = provider_expense`, `archivedAt IS NULL`. Unknown, foreign, other-context, archived-provider and debt ids answer the **same `404`** (same body, no per-case message). The nested `accounts/:accountId/provider-bills` routes and the aliases use the same owner-scoped resolution. |
| Provider lock | `provider_account_id` is immutable on `recurring` bills → `409 PROVIDER_BILL_PROVIDER_LOCKED`, checked **before** resolving any target provider, so a foreign id cannot be probed through 404-vs-409. One-offs may move unless paid; the target provider is resolved owner-scoped (uniform `404` / generic `422`). |
| `:dueDate` | Strictly parsed `YYYY-MM-DD` (impossible dates rejected). Validated per bill: generator check for `recurring` (only inside the 366-day window, so a far date cannot force iteration), equality with `due_date` for `one_off`; otherwise `404`. |
| Concurrency | The payment writer locks the `ProviderBill` row `FOR UPDATE` and re-checks the payment in the same transaction; the unique keys stay the final guard. Two bills of one provider pay concurrently (lock is per bill). |
| Paying account | `paying_account_id` goes through `PayingAccountResolver`: generic `422` with the same body for foreign, archived, non-regular and wrong-currency cases, no ids echoed; checks run owner → type / archived → currency. |
| Cap | 50 recurring bills per provider, `409 PROVIDER_BILL_LIMIT`. **Revised/added**: count and insert in one transaction under a lock on the provider row so concurrent creates cannot exceed it. The cap is a product limit. |
| Occurrence caps | The 366-day and 1000-occurrence caps are checked on **total occurrences across all bills**, not on bills; `overdue.json` is bounded the same way. |
| Queries | Calendar and overdue load recurring bills in one query (`provider_account_id IN (…) AND kind = 'recurring'`, the list scoped to the owner's non-archived providers), following `registry.loadDetails()` batching; no N+1. Indexes as in [model.md](model.md#limits-and-indexes). |
| Currency change | The rescale of every bill's `expected_amount` runs in one transaction with row locks (**added**). |
| Mass assignment | DTOs are whitelisted (`forbidNonWhitelisted`): the body never accepts `id`, `created_at` or an owner; `kind` on PATCH only if equal (otherwise `409`). **Added.** |
| Input limits | `description` trimmed, ≤ 255; `notes` length capped; `expected_amount` `> 0` and within the bigint / exponent range; `kind` filter is an allowlist (unknown → empty list) and `page` an integer; parameterized queries only (raw SQL for the virtual column and indexes lives in the migration only). **Added.** |
| Cache | GETs are user-scoped (per caller), writes never cached; see the cache tables in [api/provider-bills.md](api/provider-bills.md) and [api/payments.md](api/payments.md). |

## Reference

- [Epic #119](https://github.com/darthjee/ward/issues/119)
- [Organizations](https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth/organizations.md)
- [Bank — Bills](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)
- [Caching](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md)
- [`bill.service.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/bill.service.ts)

## Required tests

- `provider-bill.resolver.spec.ts` (new, [#122](https://github.com/darthjee/ward/issues/122)) —
  the uniform `404` for unknown, foreign, other context, archived provider and a debt id,
  identical bodies.
- `provider-bills.e2e-spec.ts` — the `404` matrix over both base paths; cross-owner and
  cross-organization denial on every verb; the cap (including concurrent creates) and the
  lock conflicts (provider lock checked before target resolution); non-whitelisted fields
  rejected; `kind` filter / `page` validation.
- [#123](https://github.com/darthjee/ward/issues/123): `:dueDate` not-an-occurrence `404` and
  impossible-date handling; concurrent payment of two bills; occurrence caps on totals; `notes`
  absent from occurrence payloads; owner-scoped alias resolution.
