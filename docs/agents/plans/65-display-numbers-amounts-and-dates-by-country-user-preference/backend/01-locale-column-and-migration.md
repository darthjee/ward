# Locale allowlist, entity column and migration

Create `backend/src/auth/user-locale.ts` exporting `USER_LOCALES` (`as const`, the seven tags in
the contract order), `type UserLocale = typeof USER_LOCALES[number]`, and
`isUserLocale(value: unknown): value is UserLocale` (exact, case-sensitive match).

Add `locale` to the `User` entity: `@Column({ type: 'varchar', length: 16, nullable: true,
default: null }) locale!: UserLocale | null;` (column name `locale`).

Add the migration `20261113120024-auth-add-users-locale.ts` (class
`AuthAddUsersLocale20261113120024`; bump the counter if a newer migration exists by then),
modelled on `20261019120014-auth-add-users-status.ts`: `up` adds a nullable `varchar(16)`
`locale` `TableColumn` to `auth_users` with no backfill (existing users → `NULL` = browser
default); `down` drops it. Registration is automatic via the glob in `data-source.ts`.

Add a migration unit spec mirroring `auth-add-users-status-migration.spec.ts` (fake query
runner): `up` adds a nullable `locale` column of the right type/length, `down` drops it. Add a
small `user-locale.spec.ts` for `isUserLocale` (each allowlisted value true; `pt-br`, `''`,
`'xx-XX'`, `null`, `1`, `{}` false).

## Files to Change

- `backend/src/auth/user-locale.ts` — new: allowlist, type, guard
- `backend/src/auth/entities/user.entity.ts` — `locale` column
- `backend/src/database/migrations/20261113120024-auth-add-users-locale.ts` — new migration
- `backend/src/database/tests/auth-add-users-locale-migration.spec.ts` — new migration spec
- `backend/src/auth/tests/user-locale.spec.ts` — new guard spec
- In-memory repo / test fixtures that build `User` objects (`backend/src/auth/tests/support/`,
  `backend/src/support/in-memory-repo.ts` users) — default `locale: null` if fixtures need the field
