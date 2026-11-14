# Backend Plan: Display numbers, amounts and dates by country / user preference

Main plan: [plan.md](plan.md)

## Shared contracts

What the backend must produce (full detail in [plan.md](plan.md#shared-contracts)):

- Allowlist `USER_LOCALES = ['en-US', 'en-GB', 'pt-BR', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const`
  in `backend/src/auth/user-locale.ts`, plus `type UserLocale` and an `isUserLocale(value)` guard.
- Nullable `locale` column on `auth_users`.
- `GET /auth/account.json` → `200 { username, email, locale }` for the caller only; JWT required;
  `Never` cached (inherited).
- `PATCH /auth/account.json` accepts `locale` (`null` or allowlisted). Non-allowlisted →
  `422 INVALID_LOCALE` ("Unsupported display locale"). Locale-only change needs no
  `currentPassword` and skips the lockout guard; any username/email/newPassword change still
  requires it. Response becomes `{ username, email, locale }`.
- Admin edit does not gain `locale`.

## Steps

- [01 — Locale allowlist, entity column and migration](backend/01-locale-column-and-migration.md)
- [02 — `GET /auth/account.json`](backend/02-get-account.md)
- [03 — `locale` on `PATCH /auth/account.json` and the password rule](backend/03-patch-account-locale.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)

## Notes

- The issue says `users`; the real table is `auth_users`.
- `@IsIn(...)` in the DTO would produce `400 VALIDATION_FAILED`, not the `422` the issue
  requires, so the allowlist check lives in the service and throws
  `UnprocessableEntityException({ code: ErrorCodes.INVALID_LOCALE, message })` like
  `admin.service.ts` does. The DTO only needs to keep the `locale` key through the
  `whitelist: true` pipe without type-rejecting it (e.g. `@IsOptional()` plus
  `@Allow()`), so that any non-allowlisted value — including non-strings — reaches the service
  and answers `422`.
- `null` vs absent matters: `null` means "reset to browser default" and must be written;
  absent means "don't touch". Today's truthy checks in `user-update.service.ts` and
  `assert-any-field-present.ts` must use `!== undefined` / `'locale' in dto` for `locale`.
- `assert-any-field-present.ts` is shared with `AdminService#editUser`; counting `locale` there
  is harmless since the admin DTO never carries it (whitelist strips it).
- Never log the locale with the username/email together beyond what is logged today.
