# Split provider — Provider bills UI

Provider detail, add / edit bill, provider list and per-bill history. Read by
[#124](https://github.com/darthjee/ward/issues/124). Back to the [README](../README.md). API in
[../api/provider-bills.md](../api/provider-bills.md); context-aware UI conventions in
[Bank — UI](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/ui.md).

## Provider detail — Bills block

Below the provider info, one row per bill: description, **kind badge** (recurring / one-off),
expected amount with its frequency, due day / month (or due date for one-offs). No balance (a
bill has none) and no `for_accountant` (a provider flag). Actions: **Add bill**, **Edit**,
**Delete**, and a link to that bill's history. `PROVIDER_BILL_PAID` and other server errors are
mapped to messages.

On an archived provider, **Add bill**, **Edit** and **Delete** are hidden, but every row (one-offs
included) keeps its **History** link, which opens the read-only per-bill history (payments
listed, Undo hidden).

## Add / edit bill

Routes `<ui>/bills/new?provider=:id` and `<ui>/bills/:billId/edit` are reused. The form opens with
a `kind` selector, **disabled on edit**. `one_off` shows the current one-off fields; `recurring`
shows description, expected amount, frequency, due day, due month (yearly only), bills from,
show in calendar and default paying account. Server errors (`NAME_TAKEN`, `LIMIT`,
`CURRENCY_MISMATCH`, …) map to field / form messages. Next to `show_in_calendar` the form
explains that unticking it is how to stop a bill that has payment history (there is no per-bill
archiving; see the README's Future epics).

## Provider list column

Replaces "expected amount with frequency" with a right-aligned **Bills** column: the count of
bills plus the recurring sums split by frequency, read from the list payload's `bills_summary`
([API](../api/provider-bills.md#bills_summary-on-the-provider-list))
(no per-row request), e.g. `3 bills · R$ 250,00 / month + R$ 1.200,00 / year`.

- Singular `1 bill`, plural `N bills`.
- A zero part is omitted; `null` and `"0.00"` sums both count as zero.
- Recurring bills without `expected_amount` count toward N but not the sums; one-offs are
  excluded from the sums (they count toward N).
- No bills (`count: 0`) → `—`; a missing `bills_summary` → an **empty** cell, not `—`.
- Sums are in the provider's single currency.
- Each part (`3 bills`, `R$ 250,00 / month`, `R$ 1.200,00 / year`) stays whole on one line; the
  cell wraps only between parts (at ` · ` and ` + `).
- Archived providers follow the same rules.

## Per-bill history

Reachable from the bill row; lists only that bill's payments (`provider-bills/:id/bill-payments.json`).

## Routes

The new screens are added to the context-aware route tables (personal and organization) in
`frontend/assets/js/utils/routing/routes.js` (see the
[frontend architecture](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/frontend.md)).
The epic's mention of `frontend/app/routing/` is wrong: that path does not exist.

## Reference

- [Epic #119](https://github.com/darthjee/ward/issues/119)
- [Bank — UI](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/ui.md)
- [Frontend architecture](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/frontend.md)
- [`routes.js`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/utils/routing/routes.js)

## Required tests

[#124](https://github.com/darthjee/ward/issues/124), Jasmine specs under `frontend/specs/`
following the folder's convention: the Bills block rows and actions; the `kind` selector
disabled on edit; field sets per kind; the list-column formatter (every rule above); the
per-bill history page; route-table entries for both contexts.
