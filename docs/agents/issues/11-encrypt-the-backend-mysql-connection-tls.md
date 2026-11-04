# Encrypt the backend ↔ MySQL connection (TLS)

## Context

Ward's production MySQL is hosted outside Render and reached over the network. The backend's
TypeORM configuration has no `ssl` option, neither in `backend/src/database/data-source.ts`
(used by the migration CLI) nor in `backend/src/app.module.ts` (`TypeOrmModule.forRootAsync`).
So the connection from Render to MySQL, which carries the database credentials and personal
data (account emails, password and refresh-token hashes), is unencrypted.

This is outside the deployment Epic (#10) and does not block deploying, but it must be done
before Ward stores data beyond accounts, and it is a **prerequisite of the `bank` module**.

## What needs to be done

Add TLS to the MySQL connection, controlled by environment variables, and require it in
production.

**Backend:**

- New environment variables:
  - `WARD_MYSQL_SSL` (`true`/`false`) enables TLS.
  - `WARD_MYSQL_SSL_CA` (optional) holds the CA certificate (PEM, `\n`-escaped like
    `SSH_PRIVATE_KEY`), for servers whose certificate is not signed by a public CA.
- Build the `ssl` option in one place and use it from both `data-source.ts` and the
  `ConfigService`-based options in `app.module.ts`, so migrations and the app connect the same
  way. Certificates are verified: `rejectUnauthorized: true`, never disabled.
- Production must set `WARD_MYSQL_SSL=true`: fail at boot when `NODE_ENV=production` and TLS
  is off, like the CORS `*` guard.
- Unit tests for the option builder (off, on with the system CAs, on with a custom CA,
  `\n`-unescaping of the CA, and the production guard).

**Docs:**

- Document the variables in `docs/agents/environment-variables.md`.
- Note (operational, outside the code): check whether the production MySQL host supports TLS.
  If it doesn't, an SSH tunnel or a TLS-capable host is the alternative.

## Acceptance criteria

- [ ] A single builder produces the TypeORM/mysql2 `ssl` option from `WARD_MYSQL_SSL` and
      `WARD_MYSQL_SSL_CA`, and is used by both `data-source.ts` and `app.module.ts`.
- [ ] With TLS on, `rejectUnauthorized` is `true`; the custom CA (with `\n` unescaped) is passed
      when `WARD_MYSQL_SSL_CA` is set, system CAs otherwise.
- [ ] With `WARD_MYSQL_SSL` unset/false, no `ssl` option is set (dev/test keep working).
- [ ] The backend refuses to boot when `NODE_ENV=production` and `WARD_MYSQL_SSL` is not `true`.
- [ ] Unit tests cover the builder and the production guard.
- [ ] `docs/agents/environment-variables.md` documents both variables.
