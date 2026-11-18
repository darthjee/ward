# Split provider — Provider-bills API

CRUD routes for `ProviderBill`. Read by [#122](https://github.com/darthjee/ward/issues/122) and
[#124](https://github.com/darthjee/ward/issues/124). Back to the [README](../README.md). Data
rules in [../model.md](../model.md); ownership in [../security.md](../security.md). `<base>` is
`/bank` or `/orgs/:orgId/bank`; fields are snake_case.

## Routes

| Route | Purpose |
|---|---|
| `GET <base>/accounts/:accountId/provider-bills.json?kind=&page=` | List a provider's bills. |
| `POST <base>/accounts/:accountId/provider-bills.json` | Create a bill (either kind). |
| `GET <base>/provider-bills/:id.json` | Read one bill. |
| `PATCH <base>/provider-bills/:id.json` | Update (merged-state validation). |
| `DELETE <base>/provider-bills/:id.json` | Delete. |

- **Nested list / create**: `:accountId` must be an owned `provider_expense` account. Archived is
  allowed for listing; creation under an archived provider → `409 ACCOUNT_ARCHIVED`. The list is
  paginated, **50 per page**, ordered recurring bills first by `description`, then one-offs by
  newest `due_date`. `kind` filters; an unknown value answers an empty list, not `404`.
- **Top-level**: `:id` resolves owner-scoped through the provider; an archived provider's bill
  answers `404` on `GET`, `PATCH` and `DELETE`.
- **`PATCH`**: validated on the merged state ([model.md](../model.md#column-groups-and-validation-matrix));
  a different `kind` → `409`; a different `provider_account_id` on a `recurring` bill → `409`; a
  one-off may move unless paid, the target provider resolved owner-scoped.
- **`DELETE`**: `409 PROVIDER_BILL_PAID` when any payment row has `status = paid`; otherwise the
  bill goes with its skipped rows (`ON DELETE CASCADE`).

## Bodies and responses

Response: `id`, `provider_account_id`, `kind`, `description`, `paying_account_id`,
`expected_amount`, `notes`, the recurring group (`charge_frequency`, `due_day`, `due_month`,
`bills_from`, `show_in_calendar`), `due_date`, `created_at`, `updated_at`. Never an owner or
organization id. Request bodies follow the validation matrix; whitelisted fields only.
`expected_amount` is a decimal string on the wire, stored in minor units of the provider's
currency. A provider currency change (only before any transaction) rescales every bill's
`expected_amount` and re-checks every bill's `paying_account_id`.

## Error codes

| Status | Code | When |
|---|---|---|
| 400 | (validation) | Violation of the matrix; field of the other group; bad `due_month` pairing |
| 404 | — | Uniform: unknown, foreign, other-context, archived-provider or debt id |
| 409 | `PROVIDER_BILL_KIND_LOCKED` | PATCH sends a different `kind` |
| 409 | `PROVIDER_BILL_PROVIDER_LOCKED` | PATCH moves a recurring bill to another provider |
| 409 | `PROVIDER_BILL_NAME_TAKEN` | Recurring `description` already used on the provider |
| 409 | `PROVIDER_BILL_PAID` | DELETE (or moving a one-off) with a paid payment |
| 409 | `PROVIDER_BILL_LIMIT` | 51st recurring bill on a provider |
| 409 | `ACCOUNT_ARCHIVED` | Create under an archived provider |
| 409 | `PROVIDER_HAS_MULTIPLE_BILLS` | Transition only: provider-expense PATCH sends a schedule field with ≥ 2 recurring bills |
| 422 | `ACCOUNT_NOT_FOUND` / `CURRENCY_MISMATCH` | `paying_account_id` fails `PayingAccountResolver` (generic body) |

## `bills.json` compatibility projection

`GET/POST <base>/bills.json` stays: it filters `kind = 'one_off'` implicitly and creates only
one-off bills (a recurring field in the body → `400`). The payload shape is unchanged apart from
the added `kind`. **Decision (revises the epic's "renamed `expected_amount`")**: `bills.json`
keeps `amount` in requests and responses (mapped to the `expected_amount` column), so the shipped
frontend keeps working untouched; the `provider-bills` routes use `expected_amount` only.
`bills.json` stays a compatibility projection until the frontend (#124) no longer uses it.
**Intended correctness fix (#122):** `PATCH bills/:id.json` moving a one-off follows the shared
move rules: a target with a different currency → `422 CURRENCY_MISMATCH` (no rescale), an
archived target → `409 ACCOUNT_ARCHIVED`. `bills.json` keeps `BILL_PAID` and its
`422 ACCOUNT_NOT_FOUND` for unknown or foreign targets.
Two write paths (`bills.json`,
`provider-bills.json`) converge on the same entity.

## Cache class (decided)

Controllers sit under `OwnerScopedController`; headers are never set by hand.

| Route | Class | Header | Invalidation |
|---|---|---|---|
| `GET …/provider-bills.json`, `GET …/provider-bills/:id.json`, `GET <base>/bills.json` | `user-scoped` | `X-Cache-Allow` | — |
| `POST`, `PATCH`, `DELETE` on the above, `POST <base>/bills.json` | `never` (`@CachePolicy(CacheClass.Never)`) | `X-Skip-Cache` | `InvalidatesOwner()` → `/bank` or `/orgs/:id/bank` (covers the new paths, the aliases, calendar and overdue) |

**Navi warms none** of them (all user-scoped or never; no change under `navi/`). The proxy needs
no change: the `*.json` rule covers the new paths, and no `filter_query_params` is added. The
migration is an out-of-band writer: reset the proxy cache on deploy.

## Reference

- [Epic #119](https://github.com/darthjee/ward/issues/119)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)
- [Caching](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md)
- [Cache warmer](https://github.com/darthjee/ward/blob/main/docs/agents/cache-warmer.md)
- [`bill.service.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/bill.service.ts)

## Required tests

[#122](https://github.com/darthjee/ward/issues/122):

- `provider-bills.e2e-spec.ts` (new) — full CRUD over both base paths; `ACCOUNT_ARCHIVED`; the
  `NAME_TAKEN`, `KIND_LOCKED`, `PROVIDER_LOCKED`, `PAID` and `LIMIT` conflicts; pagination and
  ordering; the uniform `404` matrix; cache-header assertions (`X-Cache-Allow` on GETs,
  `X-Skip-Cache` and invalidation on writes).
- `bills.e2e-spec.ts` (extend) — `bills.json` returns only `one_off`; creating through it sets
  `kind = 'one_off'`; a recurring field is `400`.
- `provider-bill.resolver.spec.ts`, `provider-bill-dtos.spec.ts` — see
  [../model.md](../model.md#required-tests) and [../security.md](../security.md#required-tests).
