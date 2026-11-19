# Issue: Split provider — frontend: provider bills management UI

## Description

Sub-issue of [#124 — Split provider — frontend provider bills UI](https://github.com/darthjee/ward/issues/124) (epic [#119](https://github.com/darthjee/ward/issues/119)).

Part **A** of #124 was the provider-bills management UI. Most of it already shipped in [#134](https://github.com/darthjee/ward/pull/134) (merged under #124). The one piece #134 skipped is the **provider list column**, because the backend did not yet send the data it needs. This issue now covers only that column.

**Blocked by [#133](https://github.com/darthjee/ward/issues/133)** (`bills_summary` on the provider list payload). Do not start until #133 is merged.

### Already delivered by #134 (out of scope here)

- Provider detail Bills block: rows, Add bill, Edit, Delete.
- Add / edit bill form (`/bank/bills/new?provider=:id`, `/bank/bills/:billId/edit`): `kind` selector, disabled on edit; field set per kind; `show_in_calendar` hint on recurring bills.
- Server error mapping for the bill form and Bills-block Delete (`PROVIDER_BILL_*`, `ACCOUNT_ARCHIVED`, `CURRENCY_MISMATCH`, `ACCOUNT_NOT_FOUND`, `PROVIDER_BILL_PAID`).
- Provider form without schedule fields.

### Also out of scope

- Part B (#132): calendar, per-bill payments and per-bill history, also shipped in #134.
- The backend `bills_summary` field itself (#133).

## Problem

The provider list (`BankProviderListHelper.jsx`) still has an **"Expected amount"** column that reads the old provider-level `expected_amount` / `charge_frequency` via `formatExpected`. After the split, those amounts live on provider bills, so the column no longer reflects what a provider is expected to charge.

## Expected Behavior

The "Expected amount" column is replaced by a **"Bills"** column, built from the `bills_summary` field (`count`, `monthly`, `yearly`) that #133 adds to each provider in the list payload. No extra request per provider row. The provider-level fields are no longer shown in the list.

The cell reads e.g. `3 bills · R$ 250,00 / month + R$ 1.200,00 / year`. The `/ month` and `/ year` suffixes match the wording `formatExpected` already uses in the Bills block and bill history.

- Parts that are zero are left out, e.g. `2 bills · R$ 250,00 / month` when there are no yearly bills.
- Recurring bills without an expected amount count toward N but not toward the sums.
- One-off bills count toward N but are not included in the sums.
- Singular vs. plural: `1 bill`, `2 bills`.
- `—` when the provider has no bills (`count` is 0).
- Amounts are formatted in the provider's currency with `formatMoney`, the same way the rest of the list formats them.
- The column is **right-aligned** (`text-end`), like Balance and the old column.

### Edge cases

- **Archived providers** (shown with *Show archived*): the cell follows the same rules as for active ones. #133 sends `bills_summary` for archived providers too.
- **Bills but no sums**: when no recurring bill has an expected amount, or the provider has only one-offs, the cell shows just the count, e.g. `2 bills`.
- **Zero sums**: `monthly` / `yearly` of `null` or `"0.00"` both count as zero, and that part is left out. This works whichever way #133 decides.
- **No `bills_summary` field** (e.g. the frontend deploys before #133's backend, or a cached older response): the cell is **empty**, not `—`, so it does not claim the provider has no bills.
- **Mixed currencies**: cannot happen. Each provider has a single currency, and all of its sums are in it.
- **Narrow screens**: the cell can wrap **between** parts, but each part stays whole on one line (`3 bills`, `R$ 250,00 / month`, `R$ 1.200,00 / year`), e.g. each part in its own `text-nowrap` span. This reduces sideways scrolling in the responsive table.

## Solution

- Add a pure formatter for the summary (e.g. `formatBillsSummary(summary, currency)` next to `formatExpected` in `providers/common/providerLabels.js`) and use it in a new "Bills" column in `BankProviderListHelper.jsx`, replacing the "Expected amount" header and cell. Update the helper's JSDoc that lists the columns.
- Keep `formatExpected`: it is still used by `ProviderBillsHelper.jsx` and `BankBillHistoryHelper.jsx`.
- Update `docs/agents/specs/split-provider/ui/provider-bills.md` (§ Provider list column) to the `/ month` / `/ year` wording and the empty-cell rule for a missing `bills_summary`.

### Tests

Jasmine specs under `frontend/specs/` for every formatter rule above: monthly only, yearly only, both, bills without an expected amount, one-offs only, no bills (`—`), and singular vs. plural "bill". Also cover the edge cases: `null` vs. `"0.00"` sums, a missing `bills_summary` (empty cell), an archived provider, and the "Bills" header (and the absence of the "Expected amount" header) in `BankProviderListHelperSpec.js`.

Owner: `frontend` agent.
