# Issue: Implement the Providers submenu and the accountant hand-off — frontend

## Description

Implement the **Providers** submenu and the accountant hand-off in the frontend.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

### Specs

- `docs/agents/specs/banking/accounts/provider-expense.md`: *Recording charges and payments* (UI shortcuts), *Business expenses for the accountant*, *Providers submenu UI*, *Performance & security* 1–2 (CSV rules), *Edge cases* 1, 4–5, 8–11, *Required tests* (UI)
- `docs/agents/specs/banking/ui/menu.md` (the **Providers** row)
- `docs/agents/backend/routes/bank.md` (*Accountant hand-off*: the preview and mark routes' bodies and replies)

### Scope

- The **Providers** entry in the Bank menu (`BANK_MENU_ENTRIES`), its routes (`ROUTES_CONTEXT`: `/bank/providers`, `/bank/providers/new`, `/bank/providers/accountant`, `/bank/providers/:accountId/edit`, `/bank/providers/:accountId`) and its section row (`SECTIONS_CONTEXT`, `sections.js`), so that switching context from a providers page (the hand-off page included) lands on the Providers list. `/new` and `/accountant` are listed before `/:accountId`.
- List, detail (provider info block, ledger, **Add charge** / **Add payment** shortcuts, sent marks with **Mark as unsent**) and create / edit pages as specified, in both contexts.
- The accountant hand-off page `<ui>/providers/accountant`: range, "Unsent only" toggle, preview with per-currency totals, **Download CSV** (client-side) and **Mark as sent**.
- The client calls for `GET /accounts.json?type=provider_expense`, create / PATCH with `type: "provider_expense"` and the nested `provider_expense` object, `GET /accountant/charges.json`, and `POST /accountant/mark-sent.json` / `mark-unsent.json` with `{ transaction_ids }`, under both prefixes.
- The wrong-type deep-link redirects in every direction: a provider-expense account opened under `<ui>/accounts/:id`, `<ui>/debts/:id` or `<ui>/investments/:id` goes to `<ui>/providers/:id`, and any other type opened under `<ui>/providers/:id` goes to its own path. With the `provider_expense` section registered, `accountTypeGuard` no longer treats `provider_expense` as not found.

### Decisions on points the spec leaves open

- **Shared code.** Build `bank/providers` on the `bank/common` parts #51 and #53 use: the ledger, the inline transaction form, the header / archive actions, the common form fields, the type guard, `ConfirmModal`, `BankErrorAlert`. Don't copy them; parameterise them where needed (e.g. the "Provider" and "Customer / contract number" labels, an optional branch, an extra per-row slot in the ledger for the sent mark). The Accounts, Debts and Investments specs must keep passing.
- **Add charge / Add payment** map onto the inline form's **In / Out** toggle: **Add charge** = Out, "Charge", with `expected_amount` suggested when set; **Add payment** = In, "Payment", amount empty. Both hidden on an archived account.
- **Frequency display.** `monthly` → "/ month", `yearly` → "/ year" (e.g. "200,00 / month"); a missing `expected_amount` shows "—". Due month shows the month name; due day / month are shown only when set.
- **Sent marks on the detail ledger.** A charge carrying `sent_to_accountant_at` shows "Sent <local date>" under its description and a **Mark as unsent** link. The link stays visible on an archived account (edge case 5), while Edit / Delete stay hidden there. Mark as unsent posts that single id to `mark-unsent.json` and reloads the ledger; no confirmation (it is the undo).
- **Warning on a sent charge.** Saving an edit of, or deleting, a charge with `sent_to_accountant_at` set first opens `ConfirmModal` ("This charge was already sent to the accountant…"); delete keeps its usual confirm, with the warning text added.
- **Hand-off range.** Two date inputs, defaulting to the last full month of the browser's local date; the API receives explicit `YYYY-MM-DD` dates. Client-side checks mirror the API's (`from` ≤ `to`, both required) and the API's `400` (future date, > 366 days, > 1000 rows) is shown with `BankErrorAlert`.
- **Preview loading.** The preview loads on page open and reloads automatically whenever a date or the "Unsent only" toggle changes, once the client-side range check passes. No Preview button. Download CSV and Mark as sent act on the rows currently loaded; both are disabled while a load is in flight.
- **Mark as sent gate.** Enabled whenever the loaded preview has rows (disabled on an empty preview, as specified); downloading first is not enforced. Clicking opens `ConfirmModal` ("Mark N charges as sent?") and only the confirmation posts the ids.
- **After Mark as sent.** The preview reloads (with "Unsent only" on, the marked rows disappear) and a success alert shows "N charges marked as sent".
- **Per-currency totals.** Summed in minor units per currency and shown under the preview, one line per currency, never a single total.
- **CSV.** Built from the loaded preview rows only. Header row in English, seven columns, the account name and `bank_name` in their own columns: `Date,Account,Provider,Provider tax id,Description,Amount,Currency`. An empty `bank_name` / `provider_tax_id` is an empty quoted field. `amount` is written as the API string (already `.` decimal, currency exponent). Rules of *Performance & security* 1–2 apply as written (every field quoted, quotes doubled, formula prefix on text cells only, UTF-8 BOM, `ward-accountant-<from>-<to>.csv`). The builder is a pure module with its own Jasmine spec.

### Docs

Updated in the same PR as the code: record each decision above in `docs/agents/specs/banking/accounts/provider-expense.md`, next to the rule it refines, marked "(decided in #55)" — in particular the CSV header row and the hand-off page's loading and confirmation behaviour.

### Depends on

- #49 (Bank menu and Accounts submenu — frontend), #51 (Debts submenu — frontend, the `bank/common` extraction), #53 (Investments submenu — frontend).
- #54 (provider-expense accounts — backend).
- #71 (accountant hand-off — backend).

### Acceptance criteria

- The frontend *Required tests* of `provider-expense.md` (UI) are covered by Jasmine specs, including the CSV format and formula-injection cases, and they pass.
- The Accounts, Debts and Investments submenus' existing specs still pass.
- Lint passes.
