# Issue: Split provider — frontend provider bills UI

## Description

Sub-issue of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
Switch the frontend to provider bills: manage several bills per provider, and pay and review
history per bill. Builds against `docs/agents/specs/split-provider/ui/…`. Requires the
`provider-bills` CRUD API and the per-bill calendar / payment routes.

#124 is an umbrella. It is implemented through sub-issues [#131](https://github.com/darthjee/ward/issues/131)
and [#132](https://github.com/darthjee/ward/issues/132) (see [Split](#split)), and the provider list column
depends on `bills_summary` from [#133](https://github.com/darthjee/ward/issues/133).

## Problem

The provider screens edit a single schedule stored on the provider, Pay and History call
account-level routes that only work while a provider has one recurring bill, and Calendar entries
show only the provider name — three bills of one provider would be indistinguishable.

## Expected Behavior

- **Provider detail** gains a **Bills** block: one row per bill — description, kind badge,
  expected amount with frequency, due day / month; actions Add bill, Edit, Delete, and a link to
  the bill's history. Paginated as the API is.
- **Add / edit bill** (`<ui>/bills/new?provider=:id`, `<ui>/bills/:billId/edit`, routes reused)
  opens with a `kind` selector, disabled on edit. `one_off` shows today's fields; `recurring`
  shows description, expected amount, frequency, due day, due month (yearly only), bills from,
  show in calendar and default paying account. Uses the `provider-bills` routes.
- **Provider list** column (from `bills_summary`, #133) becomes "N bills · R$ 250,00/mo + R$ 1.200,00/yr": monthly and yearly
  recurring sums separate, zero parts omitted, bills without an expected amount counted but not
  summed, one-offs excluded; `—` with no bills.
- **Provider form** no longer edits schedule fields.
- **Calendar entry** shows `source_bill.description` as the primary label and the provider name as
  secondary ("Internet / Vivo").
- **Pay / skip / undo** and **Bill history** use
  `provider-bills/:id/occurrences/:dueDate/payment.json` and
  `provider-bills/:id/bill-payments.json`.
- `CHARGE_KINDS` (`frontend/assets/js/client/CalendarClient.js`,
  `calendar/common/PayForm.jsx`) accepts both `provider` and `provider_bill`, so the contract
  sub-issue's rename does not break Pay.
- A new per-bill history page route is added to `ROUTES_CONTEXT` in
  `frontend/assets/js/utils/routing/routes.js` (see [Routing](#routing)). The epic's
  `frontend/app/routing/` path does not exist.

## Scope boundaries

**In scope** (frontend only, `frontend/`): everything under Expected Behavior, split across #131
and #132 (see [Split](#split)).

**Out of scope:**

- All backend / API work: the provider-bills CRUD API (#122), the per-bill calendar and payment
  routes (#123), and the `provider` → `provider_bill` rename and the transition aliases' removal
  (#125).
- Removing the legacy `provider` value from `CHARGE_KINDS`. #124 accepts both, and the cleanup
  belongs to #125 or a follow-up.
- Per-bill archiving. Unticking `show_in_calendar` is the documented way to stop a bill.
- A provider-wide aggregated bill history (no API exists for it).
- New UI for moving a one-off bill between providers. The one-off form's existing provider
  picker stays as it is today. A recurring bill's provider is locked
  (`PROVIDER_BILL_PROVIDER_LOCKED`), so the picker is disabled when editing a recurring bill.
- Accountant hand-off: `/bank/providers/accountant`, the sent-to-accountant marks and the
  `for_accountant` provider flag are unchanged.
- Bill sorting or reordering controls. Bills show in API order (recurring first by description,
  then one-offs).
- Navi / cache configuration (owned by the cache agent alongside the API issues).

## Solution

Owned by the `frontend` agent. Components under
`frontend/assets/js/components/resources/bank/`, clients under `frontend/assets/js/client/`.
Jasmine specs in the folder's existing convention: the Bills block, the `kind` selector disabled
on edit, the provider-list column formatting, the Calendar label, and both charge kinds. Update
the spec in the same PR if a decision changes.

## Split

#124 is the umbrella for two sub-issues, split by API dependency:

- **[#131](https://github.com/darthjee/ward/issues/131) (A): provider bills management UI.**
  Bills block (rows, Add / Edit / Delete), add / edit bill (`kind` selector, `show_in_calendar`
  hint, error mapping), provider list column, provider form without schedule fields. Needs only
  #122 (merged) and #133 (`bills_summary`), and can start now.
- **[#132](https://github.com/darthjee/ward/issues/132) (B): calendar, per-bill payments and
  history.** Calendar label, per-bill Pay / skip / undo, `CHARGE_KINDS`, the
  `bank-bill-history` route and page, the History link on bill rows, and dropping the provider
  Bill history block. Needs #123 (merged) and builds on #131's Bills block.

#124 closes when both are merged.

## Routing

Routes live in `frontend/assets/js/utils/routing/routes.js`. `ROUTES_CONTEXT` is one context-aware
table that serves both Personal (`/x`) and organization (`/orgs/<id>/x`) contexts, so one entry
covers both and there are no separate per-context tables to touch.

- **Reused, unchanged:** `['/bank/bills/new', 'bank-bill-new']` (`?provider=:id`) and
  `['/bank/bills/:billId/edit', 'bank-bill-edit']`.
- **New:** `['/bank/bills/:billId/history', 'bank-bill-history']`, a dedicated per-bill history
  page reached from the bill row's History link (e.g. `#/bank/bills/42/history` or
  `#/orgs/7/bank/bills/42/history`). It lists only that bill's payments from
  `provider-bills/:id/bill-payments.json` and reuses the existing `BillHistory` component
  (`components/resources/bank/common/bills/`) with the bill's id. It is bookmarkable and keeps
  the provider detail light; inline expansion and a `?bill=` query param on the provider detail
  were considered and rejected.
- The new path has the same segment count as `:billId/edit` but a distinct literal last segment,
  so ordering against it does not matter. Keep it with the other `/bank/bills/...` rows.
- `SECTIONS_CONTEXT` needs no change: the `/bank/bills` prefix already lands a context switch on
  the Providers list.
- A page component for `bank-bill-history` must be registered wherever page keys are mapped to
  components, next to `bank-bill-new` / `bank-bill-edit`.
- Specs: a `routes` spec entry for the new path, resolved in both Personal and organization
  contexts.
- Update `docs/agents/specs/split-provider/ui/provider-bills.md` (§ Per-bill history, § Routes)
  in the same PR to name the route.

## Per-bill history

- **Provider detail drops its Bill history block.** `renderAfterLedger` (the `<BillHistory
  sourceType="provider_expense">` after the ledger in `BankProviderDetailHelper.jsx`) is
  removed. Its route, `accounts/:id/bill-payments.json`, is only a transition alias for providers
  (one recurring bill) and becomes debt-only in #125, and no provider-wide history route exists.
  History is reached only from each bill row. Debt detail keeps its block unchanged. A combined
  client-side history (N requests merged) was considered and rejected.
- **Page `bank-bill-history`** (`/bank/bills/:billId/history`, see [Routing](#routing)):
  - Back link to the provider detail, labelled with the provider name (`← Vivo`).
  - Header `<bill description> — <provider name>` with the kind badge and, for recurring
    bills, the expected amount with frequency (as in the Bills row).
  - Body: that bill's paid / skipped payments, newest due date first, paginated, from
    `provider-bills/:id/bill-payments.json`, each with **Undo** (hidden while the provider is
    archived), exactly as today's `BillHistory`.
  - Loads the bill (`provider-bills/:id.json`) for the header. A missing or foreign bill shows the
    uniform not-found state.
- **Every bill row gets a History link, one-offs included.** A one-off has at most one entry.
- `BillHistory` / `useBillHistory` / `BillsClient.listBillPayments` gain a per-bill variant
  (bill id → `provider-bills/:id/bill-payments.json`) next to the account one, which debts keep.
  Undo on this page uses the per-bill `DELETE provider-bills/:id/occurrences/:dueDate/payment.json`.
- Specs: the provider detail no longer renders Bill history; the history page header, back link,
  list and Undo; the per-bill client URL.

## Spec details folded in

### Pay amount when `expected_amount` is null

`payFields.js` already starts the amount empty and requires it when the occurrence has no
`expected_amount`. No behavior change is needed, but a Jasmine spec pins it for a provider-bill
occurrence (the spec's required test).

### `show_in_calendar` hint

Recurring bills only (one-offs have no such field). Next to the checkbox:
*"Untick to stop this bill. Its payment history is kept."* This is the only way to stop a bill
that has payments, since there is no per-bill archiving.

### Server error mapping

400 validation errors map to field errors and 404 to the uniform not-found state, as today.

| Where | Code | Shown as |
|---|---|---|
| Bill form | `PROVIDER_BILL_NAME_TAKEN` | Field `description`: "A recurring bill with this description already exists for this provider" |
| Bill form | `CURRENCY_MISMATCH` (422) | Field default paying account: "Account currency must match the provider's" |
| Bill form | `ACCOUNT_NOT_FOUND` (422) | Field default paying account: "Account not available" |
| Bill form | `PROVIDER_BILL_LIMIT` | Form: "This provider already has 50 recurring bills" |
| Bill form | `ACCOUNT_ARCHIVED` | Form: "The provider is archived" |
| Bill form | `PROVIDER_BILL_KIND_LOCKED`, `PROVIDER_BILL_PROVIDER_LOCKED` | Form message (defensive; the UI never sends these changes) |
| Bill form | `PROVIDER_BILL_PAID` | Form message (moving a paid one-off). Handled alongside the existing `BILL_PAID` in `BillFormController.handleError`, which `bills.json` may still return |
| Bills block, Delete | `PROVIDER_BILL_PAID` | Recurring: "This bill has payments and can't be deleted. Untick 'Show in calendar' to stop it." One-off: the existing paid-bill message |
| Provider form | `PROVIDER_HAS_MULTIPLE_BILLS` | Not applicable: the form no longer sends schedule fields |

Any other 409 falls back to the server message, as `AccountFormController` does today.

Specs: one per mapped code (field vs. form placement), the hint rendered only for recurring bills,
and the Delete message per kind.
