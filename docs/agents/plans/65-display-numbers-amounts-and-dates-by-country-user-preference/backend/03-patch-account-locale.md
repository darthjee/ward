# `locale` on `PATCH /auth/account.json` and the password rule

**DTO** (`update-account.dto.ts`): add `locale?: unknown` with `@IsOptional()` + `@Allow()` (or
equivalent) so the key survives `whitelist: true` and any value reaches the service. Make
`currentPassword` `@IsOptional() @IsString() @IsNotEmpty()`. Do not touch
`UserFieldChangesDto` (shared with `AdminUpdateUserDto`). Update the DTO JSDoc.

**Error code**: add `INVALID_LOCALE` to `core/error-codes.ts`, with
`INVALID_LOCALE_MESSAGE = 'Unsupported display locale'` exported next to its throw site.

**`assert-any-field-present.ts`**: `locale` counts as present when `dto.locale !== undefined`
(an explicit `null` counts).

**`AccountService#updateAccount`** new order:

1. `assertAnyFieldPresent(dto)`.
2. If `locale !== undefined` and `locale !== null` and `!isUserLocale(locale)` → throw `422
   INVALID_LOCALE`. Not recorded as a lockout failure.
3. `credentialChange = username !== undefined || email !== undefined || newPassword !== undefined`.
4. If `credentialChange`: if `currentPassword` is missing → `400 VALIDATION_FAILED` with the same
   body shape the DTO produced before (use the existing validation-error helper so the e2e
   `expectValidationErrorBody` still matches); then today's flow unchanged — lockout check,
   `#loadUser`, `#applyGuardedChecks` (password + availability, recording failures),
   `applyUserUpdate`, lockout reset.
5. Else (locale-only): `#loadUser`, `applyUserUpdate` with only `locale`; no lockout check, no
   password verification (a sent `currentPassword` is ignored), no lockout reset.

**`UserUpdateService#applyUserUpdate` / `#changedColumns`**: write `locale` when
`dto.locale !== undefined` (including `null`), and return `{ username, email, locale }`.

Specs:

- `assert-any-field-present.spec.ts` — `{ locale: null }` and `{ locale: 'pt-BR' }` count;
  `{}` still rejects.
- `user-update.service.spec.ts` — writes `locale`, writes `null`, leaves it alone when absent;
  result includes `locale`.
- `account.service.spec.ts` — locale-only without password succeeds and does not call the
  lockout guard; locale-only with a wrong `currentPassword` still succeeds (ignored);
  invalid locale → 422 before any password check, no lockout failure recorded; username/email/
  newPassword without `currentPassword` → 400; with wrong password → today's 400 + failure
  recorded; credential change + locale saves both.
- `auth.controller.account.e2e-spec.ts` — the same cases end-to-end: `{ locale: 'pt-BR' }` →
  `200 { username, email, locale: 'pt-BR' }` and a following GET returns it; `{ locale: null }`
  → `200`, `locale: null`; `'pt-br'`, `'xx-XX'`, `''`, `1`, `{}` → `422 INVALID_LOCALE`
  (`expectErrorBody`); `{ username }` without `currentPassword` → `400 VALIDATION_FAILED`;
  `X-Skip-Cache: true` on every answer.
- Admin edit e2e/spec: a `locale` sent to `POST /admin/users/:id/edit.json` is stripped and not
  written.

## Files to Change

- `backend/src/auth/dto/update-account.dto.ts` — `locale`, optional `currentPassword`
- `backend/src/core/error-codes.ts` — `INVALID_LOCALE`
- `backend/src/auth/assert-any-field-present.ts` — count `locale`
- `backend/src/auth/account.service.ts` — new rule order, 422, locale-only branch
- `backend/src/auth/user-update.service.ts` — write/return `locale`
- `backend/src/auth/tests/assert-any-field-present.spec.ts`
- `backend/src/auth/tests/user-update.service.spec.ts`
- `backend/src/auth/tests/account.service.spec.ts`
- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts`
- Admin edit spec under `backend/src/auth/tests/` — locale stripped
