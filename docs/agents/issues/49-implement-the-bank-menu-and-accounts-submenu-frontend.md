# Issue: Implement the Bank menu and Accounts submenu — frontend

## Description

Implement the **Bank** menu and the **Accounts** submenu (regular accounts and their ledger) in
the frontend.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

### Specs

- `docs/agents/specs/banking/ui/menu.md`
- `docs/agents/specs/banking/accounts/regular.md`: UI sections, *Required tests*
- `docs/agents/specs/banking/accounts/transactions.md`: UI sections, *Required tests*

### Depends on

- #47 (organizations — frontend).
- #48 (bank module, regular accounts and transactions — backend).

### Acceptance criteria

- The frontend *Required tests* of the two specs are covered by Jasmine specs, and they pass.
- Lint passes.
- The decisions below (menu scope, switch landing, amount input, currency select, ledger UX, error handling) are implemented and covered as listed in *Testing strategy*.

## Problem

The bank backend (#48) is merged, but there is no UI for it: users cannot see, create or manage
regular accounts or their transactions. The specs leave several frontend details open — how the
unbuilt submenus appear, how the UI knows an account has transactions (the API exposes no flag),
where a context switch from a bank page lands, how amounts are typed in a country that uses `,`
as the decimal separator, how the currency list is searched without a component library, and how
the paginated ledger behaves — and the frontend already uses the name `accounts` for **user**
accounts.

## Expected Behavior

- The Bank menu with its submenus as specified. Debts, Investments, Providers and Calendar
  entries are added by their own sub-issues; only Accounts works here.
- Accounts list (regular only, with an archived filter), detail with balance, create / edit,
  archive / unarchive / delete.
- Ledger page: paginated, running balance, add / edit / delete transactions.
- Every page works in both contexts through the context-aware API helper from #47
  (organizations — frontend).

### Menu scope

- The header gains a **Bank** `NavDropdown` in the left nav, shown only to logged-in, approved
  users (like the other authenticated links). Its links are built from the active context
  (`#/bank/accounts` or `#/orgs/:orgId/bank/accounts`).
- #49 adds **only the Accounts entry**. Debts, Investments, Providers and Calendar are neither
  shown nor stubbed (no disabled or dead links); each is added by its own sub-issue
  (#51, #53, #55, #57).
- So #49 covers the menu mechanics and the Accounts entry from `ui/menu.md`'s *Required tests*:
  links built from the active context in both contexts, the Accounts entry listing `regular`
  accounts only, and full use in Personal with zero organizations. The "shows all five entries"
  test is completed as the later sub-issues land.

## Solution

### "Has transactions" signal

The account response has no `has_transactions` field, and #49 adds none (no backend change).
The frontend derives it from the ledger instead:

- `pagination.total_count` of `GET <base>/accounts/:accountId/transactions.json` counts real
  transactions only (the virtual opening row is not counted), so `total_count > 0` means the
  account has transactions.
- **Detail page** — already loads ledger page 1; the same response decides whether **Delete**
  is shown.
- **Edit page** — loads ledger page 1 too, only to decide whether the **currency** select is
  locked.
- The backend's `409 ACCOUNT_HAS_TRANSACTIONS` (delete) and `409 CURRENCY_LOCKED` (edit) stay
  the fallback for races (a transaction added in another tab): the page shows the error message
  and refreshes its state.

### Context switch from a bank page

`ui/menu.md` requires a switch made from a bank page to land on the **same section's list** in
the new context, never on the same record id. Today the switcher always lands on the new
context's landing page (`ContextSwitcherController.pick(context, userId, switchTarget =
landingFor)`).

- A small **section registry** sits next to `ROUTES_CONTEXT` in
  `frontend/assets/js/utils/routing/routes.js`. It maps context-relative path prefixes to their
  section's list path. #49 registers `/bank/accounts` → `/bank/accounts`; #51, #53, #55 and #57
  each add their own row.
- On a switch, the current path (stripped of any `/orgs/:orgId` prefix) is matched by prefix
  (on a segment boundary). A match lands on that section's list in the new context; anything
  else lands on the landing page, as today.
- The query string (e.g. `?archived=true`) is dropped.
- Each switcher item's `href` (used by middle-click / open in new tab) uses the same target as
  the click.

Examples:

| Current hash | Picked | Lands on |
|---|---|---|
| `#/orgs/3/bank/accounts/12/edit` | Personal | `#/bank/accounts` |
| `#/bank/accounts?archived=true` | org 5 | `#/orgs/5/bank/accounts` |
| `#/account/my-account` | org 5 | `#/orgs/5` (landing, unchanged) |

### File layout

`components/resources/accounts/` and `client/AccountsClient.js` already belong to **user**
(auth) accounts, so the bank code lives under its own `bank` area, following the modular
pattern (`architecture/modular-pattern.md`, *Frontend*):

```text
frontend/assets/js/
  client/BankClient.js                 accounts, transactions and settings.json,
                                       built on the context-aware contextPath (#47)
  components/resources/bank/
    common/                            shared bank pieces: amount / currency formatting,
                                       currency select, pagination controls
    accounts/pages/
      BankAccountList.jsx
      BankAccountDetail.jsx            detail + ledger
      BankAccountNew.jsx
      BankAccountEdit.jsx
      controllers/  helpers/           same split as resources/organizations
```

- Page keys: `bank-accounts`, `bank-account`, `bank-account-new`, `bank-account-edit`,
  registered in `ROUTES_CONTEXT` (`/bank/accounts/new` listed before `/bank/accounts/:accountId`).
- Later submenus become siblings (`bank/debts/`, `bank/investments/`, …) and reuse
  `bank/common/` and `BankClient`.
- Specs mirror the source tree under `frontend/specs/`.

### Amount input and formatting

- **Transaction sign** — the inline form row has a two-state **Out / In** toggle (default
  **Out**) and a positive amount field; the client sends `-<amount>` for Out and `<amount>` for
  In. Editing a transaction sets the toggle from the stored sign and shows the absolute value.
- **Opening balance** — a single field that accepts an optional leading `-` (an account may open
  overdrawn); default `0`.
- **Input format** — digits with **one optional decimal separator, either `.` or `,`** (so
  `12.50` and `12,50` both mean twelve and a half, whatever the browser locale), up to the
  currency's decimal places, read from
  `new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
  .maximumFractionDigits` (BRL/USD 2, JPY 0, BHD 3). **Thousands separators are not accepted**
  (`1.234,56` and `1,234.56` are invalid), so a lone separator is never ambiguous. The client
  normalises `,` to `.` before sending.
- **Client-side checks before submit** (the backend's 400 stays the authority): too many
  decimals for the currency; zero transaction amount; `|amount|` over 10¹³ minor units. The
  value is handled and sent as a **decimal string**, never through a float.
- **Display** — balances, amounts and running balances on the list, detail and ledger use
  `Intl.NumberFormat` with `style: 'currency'` in the **account's** currency and the
  **browser's default locale** (no grand total on the list). Formatting by country / user
  preference is left to #65. The API's decimal strings are formatted without float rounding loss (amounts fit
  well within `Number`'s safe range at the 10¹³ minor-unit cap, so converting the decimal string
  for formatting only is acceptable).
- These helpers live in `components/resources/bank/common/` for reuse by later submenus.

### Currency select

- A small own **`CurrencySelect`** component in `components/resources/bank/common/` — **no new
  dependency** (the frontend only has React, Bootstrap and react-bootstrap).
- A text filter input above the list (a native `<select size>` or a react-bootstrap dropdown),
  filtering case-insensitively by **code and name**. Keyboard accessible.
- Options come from `Intl.supportedValuesOf('currency')`, labelled `BRL — Brazilian Real`, with
  names from `new Intl.DisplayNames(undefined, { type: 'currency' })` (falling back to the bare
  code when no name is available).
- **Order**: the `settings.json` default currency first, then every other code A–Z.
- **Default value** on create: `default_currency` from `GET <base>/settings.json`.
- **Locked** (disabled, with a short hint) on edit once the account has transactions (see
  *"Has transactions" signal*).
- Only codes from the list can be selected; free text is never submitted.

### Ledger UX

On the account detail page (`<ui>/bank/accounts/:accountId`), below the header:

- **Columns**: date, description (with notes shown read-only beneath it when present), amount,
  running balance; newest first, as returned by the API.
- **Opening row** — the API's `opening` object is rendered as a final, muted "Opening balance"
  row on the last page only. It has no Edit / Delete: the opening date and balance are edited
  through the account's **Edit** page.
- **Pagination**:
  - The page lives in the hash query (`#/bank/accounts/12?page=3`, same under
    `#/orgs/:orgId/...`), so reload, back / forward and shared links keep it; a missing page
    means 1, an invalid one falls back to 1.
  - Controls: react-bootstrap `Pagination` with First / Prev / a window of page numbers / Next /
    Last, hidden when `total_pages` is 1.
  - A page past the end (empty `transactions`, `opening: null`) shows "No transactions on this
    page" with a link to page 1.
  - After a **create**, go to page 1 (where the newest rows are); after an **edit** or
    **delete**, reload the current page (the running balances change).
- **Inline form row** at the top of the ledger:
  - Fields: date, Out / In toggle, amount, description, and a small **Notes** toggle revealing
    the notes field.
  - Each ledger row has **Edit** and **Delete** buttons. **Edit** loads that transaction into
    the top form row (title "Editing …", **Save** / **Cancel**) and highlights the source row;
    only one form exists at a time. The Notes toggle opens automatically when the transaction
    has notes.
  - **Delete** asks for confirmation in a react-bootstrap `Modal`.
  - Field errors from the client checks or a backend 400 are shown on the row; the form keeps
    its values.
- **Dates** — `<input type="date">` with `max` = the browser's **local today**, defaulting to
  local today; the form also rejects a later date before submit. (The backend's UTC today + 1
  slack is never offered.)
- **Archived account** — the form row and every row's Edit / Delete are hidden; the ledger stays
  readable and paginated.

### Edge cases and error handling

Errors arrive as `client/ApiError.js` (`status`, `message`, `code`, `details`; see
`architecture/frontend.md`, *API errors*). Branch on `code`, never on message text.

- **404** — an unknown or other-owner account, or a non-member `:orgId`, renders the shared
  `NotFound` page (as the organization pages do). This also covers a **stale context id**: a
  remembered or linked `#/orgs/:id/bank/...` for an organization the user has left gets the
  backend's 404 → `NotFound`, with no special redirect.
- **409** — show `ApiError.message` in an inline alert, then **reload** the account (and the
  ledger) and re-render to match the new state:
  - `ACCOUNT_ARCHIVED` → the write controls disappear (archived account);
  - `ACCOUNT_HAS_TRANSACTIONS` → Delete disappears (the message points to Archive);
  - `CURRENCY_LOCKED` → the currency select becomes locked;
  - `ACCOUNT_NAME_TAKEN` → a field error on **name**; the form keeps its values (no reload).
- **400** — the `details` list is shown under the form (or form row); the form keeps its values.
- **Network / 5xx** — a dismissible alert with a **Retry** button.
- **Double submit** — Save, Delete, Archive / Unarchive and the modal's confirm are disabled
  while their request is in flight, so a double click never sends twice.
- **Unsaved inline form** — switching to another row's Edit, or changing ledger page, while the
  form row has unsaved changes asks for confirmation before discarding them.
- **`settings.json` failure** — the create form still works: the currency select has no default
  and must be chosen, with a small warning.

### Testing strategy

Jasmine specs mirroring the source tree under `frontend/specs/`, using the existing support
helpers (`fetchSequence` for faked API calls, `renderedOutput`, `renderCapturingHandlers`,
`fakeWindow`, `flushMicrotasks`). Coverage stays reported but not enforced (no new gate).

- **Spec Required tests** — every *Frontend* item of `accounts/regular.md` and
  `accounts/transactions.md`, and the `ui/menu.md` items in scope (see *Menu scope*).
- **Pure helper units** (exhaustive):
  - amount parsing: `.` and `,` both accepted as the decimal separator; thousands separators
    rejected (`1.234,56`, `1,234.56`); decimals per currency (BRL 2, JPY 0, BHD 3); zero
    rejected for a transaction; the 10¹³ minor-unit cap; a negative opening balance accepted;
    `,` normalised to `.` in the sent string;
  - Out / In sign mapping, both ways (form → API and stored amount → toggle + absolute value);
  - `Intl` currency formatting of the API's decimal strings;
  - currency list: default first, then A–Z; filtering by code and by name; missing display
    name falls back to the code;
  - the context-switch section prefix map (segment-boundary match, query dropped, fallback to
    the landing page);
  - `?page=` parsing (missing / invalid → 1).
- **Decision behaviours** (page / controller specs):
  - Delete shown and currency locked from ledger `total_count`;
  - 409 flows reload and re-render (`ACCOUNT_ARCHIVED`, `ACCOUNT_HAS_TRANSACTIONS`,
    `CURRENCY_LOCKED`); `ACCOUNT_NAME_TAKEN` as a name field error keeping the values;
  - 404 renders `NotFound`; 400 shows `details`; network / 5xx alert with Retry;
  - double-submit disabling; unsaved inline form confirmation; `settings.json` failure fallback;
  - pagination: create → page 1, edit / delete → reload the current page; page past the end
    message; opening row only on the last page and without actions;
  - the switcher landing on the same section's list from a bank page (and on the landing page
    elsewhere), with the item `href` matching.
- **`BankClient` URL specs** — every method under both `/bank/...` and
  `/orgs/:orgId/bank/...` (via `contextPath`), with `snake_case` bodies and no owner fields
  (`user_id`, `organization_id`) ever sent.
- **Lint** passes (`yarn lint`).

## Benefits

- Users can manage regular accounts and their ledger in Personal and in any organization, the
  first usable part of the bank module.
- Amount entry works for both `.` and `,` users without ambiguity; display preferences are
  tracked separately in #65.
- The bank area, client, shared helpers (currency, amounts, pagination) and the context-switch
  section registry are reusable by the Debts, Investments, Providers and Calendar sub-issues
  (#51, #53, #55, #57), which each add one menu entry and one registry row.
- No backend change and no new frontend dependency.
