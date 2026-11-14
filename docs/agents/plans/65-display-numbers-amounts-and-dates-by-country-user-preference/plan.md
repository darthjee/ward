# Plan: Display numbers, amounts and dates by country / user preference

Issue: [65-display-numbers-amounts-and-dates-by-country-user-preference.md](../../issues/65-display-numbers-amounts-and-dates-by-country-user-preference.md)

## Overview

Each user can pick a **display locale** from a fixed allowlist, or *Browser default*. The
backend stores it as a nullable `locale` column on `auth_users`, returns it from a new
`GET /auth/account.json`, and accepts it on `PATCH /auth/account.json` without
`currentPassword` when it is the only change. The frontend keeps the locale in a module-level
store that every display `Intl` call reads (amounts, month names, currency names, rates), adds
a calendar-safe `formatDate` for every displayed ISO date, and adds a *Display locale* select
to *My account*, which is now pre-filled from the new GET. Input parsing, native date inputs,
API values and the accountant CSV do not change.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

After both finish (architect coordinates):

- `security` reviews the new GET, the new field and the relaxed password rule (locale-only
  PATCH without `currentPassword`).
- `data-access` reviews the new GET response fields (`username`, `email`, `locale`, caller only).
- `cache` confirms the new GET is `Never` (inherited from `AuthController`), sends
  `X-Skip-Cache: true`, and stays out of Navi's warm-up config.
- The architect updates the docs (see "Documentation" below).

## Shared contracts

### Locale allowlist

Exactly these BCP 47 tags, in this order (the frontend select uses the same order):

| Value | Frontend label |
| --- | --- |
| `null` | `Browser default` (the default) |
| `en-US` | `English (United States)` |
| `en-GB` | `English (United Kingdom)` |
| `pt-BR` | `Português (Brasil)` |
| `pt-PT` | `Português (Portugal)` |
| `es-ES` | `Español (España)` |
| `fr-FR` | `Français (France)` |
| `de-DE` | `Deutsch (Deutschland)` |

The backend owns the authoritative list (`USER_LOCALES` in `backend/src/auth/user-locale.ts`);
the frontend mirrors it in `frontend/assets/js/utils/locale/locales.js`. Both must stay in sync;
adding a locale means changing both.

### `GET /auth/account.json` (new)

- Auth: default `JwtGuard` (no `@Public()`); any gate rejection answers the standard gate `401`.
- Cache: `@CachePolicy(CacheClass.Never)` + `@NoCacheInvalidation()` inherited from
  `AuthController`; response sends `X-Skip-Cache: true` / `Cache-Control: no-store`.
- Request: no body, no query.
- `200` response, caller's own row only:

  ```json
  { "username": "alice", "email": "alice@example.com", "locale": "pt-BR" }
  ```

  `locale` is `string | null` (`null` = browser default). No `id`, `isAdmin`, `status` or
  `passwordDigest`.

### `PATCH /auth/account.json` (changed)

- Body: `{ currentPassword?, username?, email?, newPassword?, locale? }`.
  - `locale` is optional; when present it is either `null` or one allowlisted string.
  - `currentPassword` becomes optional in the DTO.
- Rules:
  - No field among `username`, `email`, `newPassword`, `locale` present → existing
    "no field" rejection, unchanged.
  - `locale` present and not `null` and not in the allowlist (any other string, empty string,
    number, object, wrong case such as `pt-br`) → `422`
    `{ error: { code: "INVALID_LOCALE", message: "Unsupported display locale" }, statusCode: 422, timestamp }`.
    This check runs before the password check and does not count as a lockout failure.
  - Any of `username`, `email`, `newPassword` present → `currentPassword` is required exactly as
    today (missing → `400 VALIDATION_FAILED`; wrong → today's `400`, counted by the lockout
    guard; lockout applies). `locale` may be sent alongside and is saved in the same update.
  - **Only** `locale` present → no `currentPassword` needed; if one is sent it is ignored (not
    verified). The lockout guard is neither checked nor updated.
- `200` response: `{ username, email, locale }` (same shape as the GET — `locale` is added to
  today's `{ username, email }`).
- `AdminUpdateUserDto` / `POST /admin/users/:id/edit.json` do **not** gain `locale`.

### Frontend consumption

- `AccountsClient.getAccount()` → `GET /auth/account.json` → `{ username, email, locale }`.
- `AccountsClient.updateAccount({ currentPassword, username, email, newPassword, locale })`
  sends `locale` (including an explicit `null`) only when the caller passes the key, and sends
  `currentPassword` only when defined.

## Documentation (architect, after implementation)

- `docs/agents/backend/routes/auth.md` — add `GET /auth/account.json` and a full
  `PATCH /auth/account.json` section (it is mentioned but never described today), the password
  rule, `INVALID_LOCALE` in the error-code table, source files (`user-locale.ts`).
- `docs/agents/modules/auth.md` — `locale` on `auth_users` in "Entities", the two account routes.
- `docs/agents/architecture/backend.md` — `auth_users` row in "Owned tables" if columns are
  listed there.
- `docs/agents/architecture/frontend.md` — `AccountsClient.getAccount`, the `DisplayLocale`
  store, how it is loaded and reset on auth changes.
- `docs/agents/modules/bank/ui.md` — amounts, rates, month/currency names and dates follow the
  display locale; dates use `formatDate`; input and CSV unchanged.
- `docs/agents/architecture/security.md` — the locale-only PATCH exemption from
  `currentPassword` and the lockout guard.
