# Issue: Display numbers, amounts and dates by country / user preference

## Description

Let each user choose the **display locale** for numbers, amounts and dates, instead of Ward always
following the browser's default locale. Raised while enhancing #49: a Brazilian user may prefer `.`
as the decimal separator, or want display to follow a chosen country rather than the browser.

### How it works today

Paths below are under `frontend/assets/js/components/resources/bank/common/` unless stated.

- **Amounts.** `formatMoney(decimal, currency)` (`amounts.js:138`) uses
  `Intl.NumberFormat(undefined, {style: 'currency', currency})`, i.e. the browser locale. It is the
  single entry point for about 16 call sites (account / debt / provider / investment lists and
  headers, ledger, bill history, accountant preview). Its JSDoc already defers display
  preferences to this issue.
- **Month names.** `monthName` (`dates.js:38`) uses `Intl.DateTimeFormat(undefined, {month: 'long'})`.
- **Currency names.** `currencies.js:32` uses `Intl.DisplayNames(undefined, {type: 'currency'})`.
- **Rates** are rendered as `` `${rate}%` `` from the raw API decimal (`rates.js:36`), unlocalized.
- **Dates** are shown as raw ISO `YYYY-MM-DD` everywhere (ledger, bill history, accountant
  preview, detail pages). Date inputs are native `type="date"` and follow the browser.
- **Input.** `parseAmount` (`amounts.js:4,68`) accepts digits with one optional `.` or `,` decimal
  separator and no thousands separators, independent of locale. Rates parse the same way.
- **User.** The `users` table has no preference column. There is no endpoint that returns the
  current user's profile: *My account* (`PATCH /auth/account.json`, which always requires
  `currentPassword`) starts with blank fields. `AuthController` is `@CachePolicy(CacheClass.Never)`.
- The UI text is English only (`<html lang="en">`). The API returns plain decimal strings and ISO
  dates, so no backend response is locale-dependent.

## Decisions

- **One setting: a display locale.**
  - The user picks a *Display locale* from a fixed allowlist (initially `en-US`, `en-GB`, `pt-BR`,
    `pt-PT`, `es-ES`, `fr-FR`, `de-DE`), or **Browser default**, which is the default.
  - The chosen locale replaces `undefined` in every display `Intl` call. A user who wants `.`
    decimals with Brazilian context picks `en-US`; there are no separate separator overrides.
  - It changes formatting only, never the UI language: the text stays English and
    `<html lang="en">` stays.
- **Stored on the backend, per user.**
  - A nullable `locale` column on `users` (`NULL` = browser default), added by a migration.
  - The backend validates it against the same allowlist: any other value is a `422`.
  - New `GET /auth/account.json` returns the caller's `{username, email, locale}`, `Never` cached
    like the rest of `AuthController`. *My account* uses it to pre-fill its fields.
  - `PATCH /auth/account.json` accepts `locale`. Changing **only** `locale` does not require
    `currentPassword`; any change to username, email or password still does. The `security`
    agent reviews this relaxation.
  - Under #61 the auth writes keep declaring no invalidation, since nothing they touch is cached.
- **Frontend.**
  - The preference is loaded after login / on app start and exposed through one shared source
    (context or module) that the formatting helpers read. Logged-out pages, and the moment
    before it loads, use the browser default.
  - Saving the preference on *My account* applies it immediately, without a reload.
  - **Amounts** (`formatMoney`), **month names**, **currency names** and **rates** follow the
    locale. Rates are formatted as locale numbers with the existing precision, plus `%`.
  - **Dates are localized**: a new shared `formatDate` helper renders displayed `YYYY-MM-DD`
    values as a short numeric date in the chosen locale (e.g. `14/03/2026` for `pt-BR`). It must
    treat the value as a calendar date, so no time-zone shift moves it by a day. Every place that
    shows a raw ISO date uses it.
  - **Not changed:** native date inputs; values sent to the API (still plain decimals and ISO
    dates); stored text such as payment descriptions, which already embed an ISO date.
- **Input and CSV stay as they are.**
  - Amount and rate input keep accepting `.` or `,` as the decimal separator with no thousands
    separators, whatever the locale.
  - The accountant CSV export stays raw (ISO dates, `.` decimals) for accountants.
- **Calendar (#77)** is not built yet. When it is, its day, weekday and month labels use the same
  locale-aware helpers. That is #77's job, not this issue's.

## Scope

- **`backend` agent:** the `locale` column and migration; the allowlist and validation; `GET
  /auth/account.json`; `locale` on `PATCH /auth/account.json` with the password rule above; specs.
- **`frontend` agent:** loading and sharing the preference; the *Display locale* select on *My
  account*, and pre-filling its fields from `GET /auth/account.json`; passing the locale to
  `formatMoney`, `monthName`, currency names and rates; the new `formatDate` and its use wherever
  an ISO date is displayed; Jasmine specs.
- **Docs (architect):** `docs/agents/modules/bank/ui.md` (amount and date display),
  `docs/agents/backend/routes/` for the auth routes, and the user model docs.
- The `security` and `data-access` agents review the new endpoint, field and password rule.

## Out of scope

- Translating UI text (i18n).
- Locale-aware amount parsing, thousands separators in input, or a localized CSV export.
- Per-organization or per-account locales.
- The Calendar views themselves (#77).

## Acceptance criteria

- Backend specs: the migration adds a nullable `locale`; `GET /auth/account.json` returns
  `{username, email, locale}` for the caller and requires auth; `PATCH` accepts an allowlisted
  locale or `null` without `currentPassword`, rejects any other value with `422`, and still
  requires `currentPassword` for username / email / password changes.
- Frontend specs:
  - with `pt-BR`, an amount shows as `R$ 1.234,56`-style and a date as `14/03/2026`; with
    `en-US`, as `$1,234.56`-style and `3/14/2026`; with no preference, the browser default is
    used;
  - `formatDate` never shifts a date by a day, whatever the time zone;
  - *My account* pre-fills its fields, saves the locale without a password, and the new format
    applies without a reload;
  - amount input still accepts both separators, and the CSV export is unchanged.
- The docs describe the preference, and the existing backend and frontend specs and lint pass.

## Related

- #49: Bank menu and Accounts submenu (frontend), where this was raised.
- #77: Calendar views, which will use the same helpers.
- #61: cache invalidation on writes; auth writes declare none.
