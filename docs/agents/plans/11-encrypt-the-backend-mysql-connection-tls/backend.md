# Backend Plan: Encrypt the backend ↔ MySQL connection (TLS)

Main plan: [plan.md](plan.md)

## Overview

Build the mysql2 `ssl` option in one place from `WARD_MYSQL_SSL` / `WARD_MYSQL_SSL_CA`, use it
in both `src/database/data-source.ts` (TypeORM CLI, reads `process.env`) and the
`TypeOrmModule.forRootAsync` factory in `src/app.module.ts` (reads `ConfigService`), and fail
at boot when `NODE_ENV=production` and TLS is off — mirroring the CORS `*` guard in
`src/core/cors-config.ts`.

## Context

- Nothing in `backend/src` configures `ssl` today, so the Render → MySQL link is plaintext.
- `data-source.ts` is the only place reading `process.env`; every other builder
  (`buildSecretKeys`, `buildCorsOptions`) takes `ConfigService`. To share one builder, take a
  reader function instead: `export type EnvReader = (key: string) => string | undefined;`.
- TypeORM types `ssl` as `any`; mysql2 accepts `SslOptions` (`ca`, `rejectUnauthorized`, ...).
- No precedent for `\n`-escaped PEM in the backend — this introduces it.

## Implementation Steps

### Step 1 — Add the SSL option builder and production guard

Create `backend/src/database/mysql-ssl.ts` exporting:

- `type EnvReader = (key: string) => string | undefined`
- `buildMysqlSslOptions(read: EnvReader): { ca?: string; rejectUnauthorized: true } | undefined`
  - `WARD_MYSQL_SSL` trimmed, lowercased: `'true'` → TLS on; unset/blank/`'false'` → off;
    any other value throws an error naming the variable (fail fast on typos).
  - TLS off: return `undefined`, but throw when `NODE_ENV` (trimmed) is exactly
    `'production'` — message like `WARD_MYSQL_SSL must be "true" when NODE_ENV=production`.
  - TLS on: return `{ rejectUnauthorized: true }`, plus `ca` when `WARD_MYSQL_SSL_CA` is
    non-blank, with literal `\n` sequences converted to newlines (`raw.replace(/\\n/g, '\n')`).
    Omit `ca` entirely when unset so Node's default CAs apply. `rejectUnauthorized` is never
    configurable.
- Env var names as module-level consts; JSDoc with `@param`/`@returns`/`@throws`, matching
  `src/core/cors-config.ts`.

Add `backend/src/database/tests/mysql-ssl.spec.ts` (or the location matching the existing
spec conventions) passing `(k) => env[k]`: off (unset, `false`), on with system CAs, on with a
custom CA (verifies `\n` unescaping), invalid value throws, production + off throws,
production + on succeeds, non-production + off succeeds.

### Step 2 — Use the builder in both connection configs

- `src/database/data-source.ts`: `ssl: buildMysqlSslOptions((key) => process.env[key])`.
- `src/app.module.ts` factory: `ssl: buildMysqlSslOptions((key) => configService.get<string>(key))`.
- Update the JSDoc of both to mention TLS. Make sure the integration-test data source
  (`src/database/tests/integration/test-data-source.ts`) is unaffected (it uses its own
  `WARD_TEST_MYSQL_*` config and must not inherit the production guard).
- Note: because `data-source.ts` is used by the migration CLI on Render, migrations also get
  TLS and the production guard — intended.

## Files to Change

- `backend/src/database/mysql-ssl.ts` — new builder + guard
- `backend/src/database/tests/mysql-ssl.spec.ts` — new unit tests
- `backend/src/database/data-source.ts` — pass `ssl`
- `backend/src/app.module.ts` — pass `ssl` in `TypeOrmModule.forRootAsync`

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn build`
- `backend_integration` runs against a non-TLS MySQL without `NODE_ENV=production` — must keep
  passing unchanged.

## Notes

- Never run yarn/node on the host — always through `docker-compose run`.
- Do not touch `docs/agents/`, `.env.dev.sample` or root files — the architect handles them.
- Deployment caveat (for the PR description): Render must get `WARD_MYSQL_SSL=true` (plus
  `WARD_MYSQL_SSL_CA` if the MySQL host uses a private CA) before this ships, or production
  will refuse to boot. Whether the production MySQL host supports TLS still needs checking.
