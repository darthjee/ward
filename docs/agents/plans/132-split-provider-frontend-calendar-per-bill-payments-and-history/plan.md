# Plan: Split provider — frontend: calendar, per-bill payments and history

Issue: [132-split-provider-frontend-calendar-per-bill-payments-and-history.md](../../issues/132-split-provider-frontend-calendar-per-bill-payments-and-history.md)

## Overview

Keep each bill's payment history reachable on an archived provider. The Bills block on the
provider detail page will always show the **History** link. **Edit** and **Delete** stay hidden
while the provider is archived.

Exploration found a backend gap that the issue does not mention. The per-bill history page
(`BankBillHistory.jsx`, through `billHistoryPageLoad.js`) loads the bill with
`GET <base>/provider-bills/:id.json`. That route answers the uniform `404` for an
archived-provider bill (`ProviderBillService.find` → `resolver.resolve` without
`allowArchived`). So a History link that is always shown would still land on Not-found. The
other two calls the page makes already work on archived providers: `GET <base>/accounts/:id.json`
and `GET <base>/provider-bills/:id/bill-payments.json` (`allowArchived: true`). The plan therefore
makes the single-bill **GET** allow archived providers, the same way the list and history reads
already do. `PATCH` and `DELETE` keep answering `404`. This is what the issue expects ("the
per-bill history page keeps its current behaviour on archived providers: payments are listed and
Undo is hidden").

Order: `backend` first (API), then `frontend`, which depends on the GET working.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

- `GET <base>/provider-bills/:id.json`, where `<base>` is `/bank` or `/orgs/:orgId/bank`:
  - **Changed**: answers `200` with the usual `ProviderBillResponse` when the bill's provider is
    archived. The response shape is unchanged.
  - **Unchanged**: the uniform `404` for unknown, foreign, other-context and debt ids.
- `PATCH` / `DELETE <base>/provider-bills/:id.json`: **unchanged**. They still answer the
  uniform `404` for an archived-provider bill, so archived providers stay read-only.
- `GET <base>/provider-bills/:id/bill-payments.json` and `GET <base>/accounts/:id.json`:
  unchanged. Both already allow archived providers.
- Frontend archived check: truthy `account.archived_at` (unchanged).

## Reviews after implementation

- `security`: authorization changes on an existing endpoint (the GET read widens to archived
  providers). Owner scoping must stay intact, and writes must still be rejected.
- `cache`: confirm that the GET's cache class (`@CachePolicy`, user-scoped) is unchanged. No Navi
  warm-up change is expected.
