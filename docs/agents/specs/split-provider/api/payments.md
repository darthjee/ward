# Split provider — Payments, history and occurrences

Per-bill payment and history routes, the occurrence payload and `OccurrenceKind` staging. Read
by [#123](https://github.com/darthjee/ward/issues/123),
[#124](https://github.com/darthjee/ward/issues/124) and
[#125](https://github.com/darthjee/ward/issues/125). Back to the [README](../README.md).
`<base>` is `/bank` or `/orgs/:orgId/bank`.

## Routes

| Route | Purpose |
|---|---|
| `GET <base>/provider-bills/:id/bill-payments.json?page=` | That bill's payment history only. |
| `POST <base>/provider-bills/:id/occurrences/:dueDate/payment.json` | Pay an occurrence. |
| `DELETE <base>/provider-bills/:id/occurrences/:dueDate/payment.json` | Undo / reset. |

- Both kinds are served. `:dueDate` must be a real nominal occurrence of that bill (generator
  check for `recurring`, equality with `due_date` for `one_off`), else `404`
  ([../security.md](../security.md)).
- Paying writes the same three transactions as today (payment on the provider, withdrawal on the
  paying account, optional charge) and one `bank_bill_payments` row keyed by
  `(provider_bill_id, due_date)` (one-offs by `bill_id`).
- A second payment of the same bill and date → `409 OCCURRENCE_ALREADY_PAID`; two different
  bills of one provider on the same date both succeed. The writer locks per bill.
- A bill with `expected_amount = null` requires an explicit amount at payment time.

## Account-level routes

- `POST/DELETE <base>/accounts/:accountId/occurrences/:dueDate/payment.json` and
  `GET <base>/accounts/:accountId/bill-payments.json` serve **`debt` only** after
  [#125](https://github.com/darthjee/ward/issues/125).
- For a `provider_expense` account they answer the same uniform `404` as an unknown or foreign
  account (same status and body).
- **Transition aliases** (#123 – #124, **removed in #125**): for a provider they resolved to its
  single recurring bill; with zero or several → the uniform `404`.

## Occurrence payload

- `source_account` is unchanged (`{ id, name, type }` of the provider or debt).
- New `source_bill: { id, description } | null` — set for provider-bill and one-off-bill
  occurrences, `null` for debt. `notes` never appears.
- Sort: by `kind`, then the **bill id before the source account id**, so two bills of one
  provider on the same day order deterministically.
- `overdue.json` lists each recurring bill's unpaid occurrences independently, bounded by the
  366-day / 1000-occurrence caps counted on total occurrences.
- The payment-map key in `calendar.service.ts` becomes `${providerBillId}:${nominal}` for
  provider bills; debts keep `${sourceAccountId}:${nominal}`.
- **Off-schedule** (history) is computed per bill against that bill's own current schedule;
  editing one bill never marks another's payments off-schedule. With `show_in_calendar: false`
  history rows are still `off_schedule: false` when the dates match.

## `OccurrenceKind` staging

Since #125, `OccurrenceKind` is `'debt' | 'provider_bill' | 'bill'`: recurring provider-bill
occurrences carry `kind: 'provider_bill'` and `source_bill`. The frontend `CHARGE_KINDS` is
`['provider_bill', 'bill']`.

History: through #123 and #124 it was `'debt' | 'provider' | 'bill'` (recurring provider-bill
occurrences kept `kind: 'provider'`), and #124 made the frontend accept both values.

## Cache class (decided)

| Route | Class | Header | Invalidation |
|---|---|---|---|
| `GET …/provider-bills/:id/bill-payments.json`, `GET …/accounts/:id/bill-payments.json` (debt only) | `user-scoped` | `X-Cache-Allow` | — |
| `POST` / `DELETE …/payment.json` (per-bill, and account-level for debts) | `never` | `X-Skip-Cache` | `InvalidatesOwner()` (clears ledger, balances, calendar, history under the owner prefix) |
| `calendar.json`, `overdue.json` (existing) | `user-scoped` (unchanged) | `X-Cache-Allow` | — |

Navi warms none of them.

## Reference

- [Epic #119](https://github.com/darthjee/ward/issues/119)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)
- [Bank — Bills](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md)
- [`bill-payment.writer.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/bill-payment.writer.ts)
- [`calendar.service.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/calendar.service.ts)
- [`bill-history.service.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/bill-history.service.ts)

## Required tests

- [#123](https://github.com/darthjee/ward/issues/123): `occurrences.spec.ts` (three recurring
  bills → three series; clamp and weekend shift per bill), `calendar-units.spec.ts` (map key per
  kind, `source_bill` presence, comparator with two bills on one day), `bill-history.spec.ts`
  (per-bill history and `off_schedule`), `bill-payment.writer.spec.ts` (the three `find()`
  branches, `409` on repeat, two bills same date, the `PROVIDER_BILL_PAID` guard),
  `bill-payments.e2e-spec.ts` (per-bill routes, aliases with one / zero / several bills),
  `calendar.e2e-spec.ts` (extension), cache-header assertions.
- [#125](https://github.com/darthjee/ward/issues/125): account-level routes `404` for providers,
  `OccurrenceKind` rename.
- `accountant.e2e-spec.ts` unchanged and green.
