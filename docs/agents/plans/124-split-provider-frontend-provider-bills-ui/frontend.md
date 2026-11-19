# Plan: Split provider — frontend provider bills UI

Issue: [124-split-provider-frontend-provider-bills-ui.md](../../issues/124-split-provider-frontend-provider-bills-ui.md)
Main plan: [plan.md](plan.md)

## Overview

The plan is frontend-only and is delivered in two sub-issues:

- **#131, management UI (steps 01–07):** a `ProviderBillsClient`, the Bills block on the
  provider detail, the add / edit bill form with a `kind` selector, the provider form without
  schedule fields, and the provider list column.
- **#132, calendar, payments and history (steps 08–14):** the per-bill pay / undo / history
  client, `CHARGE_KINDS`, the Calendar label, pay / undo routing, a per-bill `BillHistory`, the
  `bank-bill-history` page and route, and removing the provider Bill history block.

## Context

The backend already exposes these routes:

- **Bill CRUD:** `GET|POST accounts/:accountId/provider-bills.json?kind=&page=` returns
  `{ provider_bills, pagination }`, 50 per page, recurring bills first.
  `GET|PATCH|DELETE provider-bills/:id.json` returns 404 when the provider is archived, and
  DELETE returns 204.
- **Bill response:** `id, provider_account_id, kind, description, paying_account_id,
  expected_amount (string|null), notes, charge_frequency, due_day, due_month, bills_from,
  show_in_calendar, due_date, created_at, updated_at`. It returns raw ids and carries no
  provider name or currency.
- **Payments and history:** `GET provider-bills/:id/bill-payments.json?page=` returns
  `{ payments, pagination }` and also works for archived providers.
  `POST|DELETE provider-bills/:id/occurrences/:dueDate/payment.json` takes the same pay body
  as today (`status, paid_on, amount, paying_account_id, record_charge`).
- **`source_bill`:** occurrences and history rows carry `source_bill: { id, description } |
  null`.

`bills_summary` (#133) does **not** exist in the backend yet (see step 07).

Every path below is relative to `frontend/assets/js/`, and `BANK` stands for
`components/resources/bank/`. Specs mirror the source path under
`frontend/specs/assets/js/` as `*Spec.js`.

## Steps

### #131: provider bills management UI

- [01 — ProviderBillsClient (CRUD)](frontend/01-provider-bills-client.md)
- [02 — Bills block component](frontend/02-bills-block.md)
- [03 — Wire the Bills block into the provider detail](frontend/03-provider-detail-wiring.md)
- [04 — Bill form: fields, loading and submit per kind](frontend/04-bill-form-fields-and-controller.md)
- [05 — Bill form: kind selector, recurring fields and error mapping](frontend/05-bill-form-render-and-errors.md)
- [06 — Provider form without schedule fields](frontend/06-provider-form-strip-schedule.md)
- [07 — Provider list bills summary column](frontend/07-provider-list-column.md)

### #132: calendar, per-bill payments and history

- [08 — Per-bill payment and history client calls](frontend/08-per-bill-payments-client.md)
- [09 — CHARGE_KINDS and pay amount spec](frontend/09-charge-kinds-and-pay-fields.md)
- [10 — Calendar label and occurrence key](frontend/10-calendar-label-and-key.md)
- [11 — Calendar pay / skip / undo per bill](frontend/11-calendar-pay-undo-routing.md)
- [12 — BillHistory per-bill variant](frontend/12-bill-history-per-bill.md)
- [13 — bank-bill-history page and route](frontend/13-bill-history-page-and-route.md)
- [14 — Drop provider Bill history, add History links](frontend/14-detail-cleanup-and-history-link.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn test` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- **Archived providers:** `GET provider-bills/:id.json` returns 404 when the provider is
  archived, so the bill form and the history page can't load on an archived provider. On an
  archived provider, the Bills block hides Add (`AddBillLink` already does this), Edit, Delete
  and History. The history page shows the uniform not-found state on 404. This means bill
  history isn't reachable for archived providers. That is a known gap, and a backend follow-up
  could let that GET read archived providers. The history page still hides Undo when the
  provider is archived, as a defensive measure.
- **Bills block placement:** the spec says "below the provider info". `AccountDetailHelper`
  has no slot there, so step 03 adds an optional `renderAfterHeader` slot. Debts and other
  account types don't pass it, so they render as before.
- **Provider info:** `ProviderInfoHelper` stops showing provider-level Expected amount,
  Frequency, Due day / month and the schedule info. They come back null once a provider has
  several bills, and the Bills block now shows them per bill.
- **One-offs move to `provider-bills` too:** the bill form uses `expected_amount` instead of
  `amount`, and raw `provider_account_id` / `paying_account_id` instead of `{ id }` objects.
  `BillsClient`'s one-off routes stay for any remaining callers. `BILL_PAID` is still handled
  next to `PROVIDER_BILL_PAID`.
- **Occurrence key bug:** `occurrenceKey.js` doesn't include the bill. Two recurring bills of
  one provider due on the same day get the same key, which breaks React keys and the overdue
  de-duplication. Step 10 fixes this, although the issue doesn't call it out.
- **`CHARGE_KINDS`** keeps `provider` and `bill` and adds `provider_bill`. Removing the legacy
  values belongs to #125.
- **Dependency on #133:** step 07 needs #133. If #133 hasn't merged when the rest of #131 is
  ready, ship #131 without step 07 and land step 07 with or after #133.
- #132 builds on #131: the History link goes on the Bills block rows from step 02.
