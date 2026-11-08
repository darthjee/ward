# Environment Variables

Every environment variable Ward's production deployment needs, gathered from what the code
actually reads (not just what's documented elsewhere) — grep the `Source` column if in doubt.
Local dev's equivalent is `.env.dev.sample` (copied to `.env` by `make setup`); nothing here
should drift from that file without a reason noted below. Real `.env.prod` / CircleCI project
variables are never committed (`.gitignore`) — this doc is the map for filling them in.

## 1. Backend application runtime

Set on the backend host (Render service env vars in the real deployment; `.env.prod` when
running `ward_prod_app` locally to sanity-check the production image).

| Variable | Status | Purpose | Source |
|---|---|---|---|
| `WARD_SECRET_KEY` | **Consumed** | The current secret key. Signs every new JWT access token, derives the HMAC cache token (`CacheTokenService` has no callers yet), and is the first secret handed to `cookie-parser` (no cookie is signed today, so this is dormant). Must be a long random value in production — the dev sample ships an intentionally insecure placeholder. See "Rotating `WARD_SECRET_KEY`" below. | `backend/src/core/secret-keys.ts`, `backend/src/app.module.ts`, `backend/src/core/cache-token.service.ts`, `backend/src/main.ts` |
| `WARD_PREVIOUS_SECRET_KEYS` | **Consumed**, optional | Comma-separated list of retired secret keys, still accepted when verifying JWT access tokens (tried after the current key, in order) and passed to `cookie-parser` after the current key. Never used to sign anything. Entries are trimmed; blanks, duplicates and any entry equal to `WARD_SECRET_KEY` are dropped. Defaults to empty. | `backend/src/core/secret-keys.ts`, `backend/src/core/jwt.guard.ts`, `backend/src/main.ts` |
| `WARD_ACCESS_TOKEN_TTL_MS` | **Consumed**, optional | Access-token lifetime, in milliseconds. Drives both the signed JWT's `signOptions.expiresIn` (`app.module.ts`, converted to seconds for `jsonwebtoken`) and the `access_token` cookie's `maxAge` (`auth.controller.ts`, used as-is), so the two always agree. Defaults to `900000` (15 minutes) when unset. | `backend/src/app.module.ts`, `backend/src/auth/auth.controller.ts` |
| `WARD_AUTHORIZATION_REQUEST_TTL_MS` | **Consumed**, optional | How long a device-authorization request (`POST /auth/authorization-requests.json`) stays pollable before lazily flipping to `expired`, in milliseconds. Defaults to `3600000` (1 hour) when unset. | `backend/src/auth/authorization-request.service.ts` |
| `WARD_AUTHORIZATION_REQUEST_CREATE_LIMIT` | **Consumed**, optional | Per-IP/per-username request count allowed within the sliding window before `create` is throttled. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `WARD_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS` | **Consumed**, optional | Sliding window (milliseconds) the `create` rate limit above counts requests over. Defaults to `60000` (1 minute). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `WARD_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER` | **Consumed**, optional | Cap on a resolved user's simultaneous `open` authorization requests; the oldest is evicted (flipped to `expired`) to make room for a new one rather than rejecting it. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `WARD_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive wrong-password `authorize` attempts, per request row, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `WARD_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `WARD_ACCOUNT_EDIT_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive failed `PATCH /auth/account.json` attempts (wrong current password, duplicate username/email), per user, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `WARD_ACCOUNT_EDIT_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `WARD_USER_APPROVAL_REQUIRED` | **Consumed**, optional | `'true'` makes new self-registrations start `pending` until an admin approves them; anything else (default) starts them `approved`. Boot-time only; never changes existing users and never disables the `approved` requirement. See [User approval](modules/auth/user-approval.md#configuration). | `backend/src/auth/user-approval.config.ts`, `backend/src/auth/auth.module.ts` |
| `NODE_ENV` | **Consumed**, set to `production` in production | Read only by the CORS resolver: when exactly `production`, a `*` entry in `WARD_ALLOWED_ORIGINS` fails boot. The guard fails open — if it is unset or mistyped (`prod`), a `*` is accepted and reflects any origin with credentials — so production deployments must set `NODE_ENV=production`. Nothing else depends on it — the access-token cookie is always `Secure`/`httpOnly`/`SameSite=Strict` regardless of environment. | `backend/src/core/cors-config.ts` |
| `PORT` | **Consumed**, optional | Port the Nest HTTP server listens on (defaults to `8080`). Render injects its own `PORT` automatically — only set this explicitly for other hosts. | `backend/src/main.ts` |
| `WARD_MYSQL_HOST` | **Consumed** | Production MySQL connection. | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `WARD_MYSQL_PORT` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `WARD_MYSQL_USER` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `WARD_MYSQL_PASSWORD` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `WARD_MYSQL_NAME` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `WARD_MYSQL_SSL` | **Consumed**, required `true` in production | Enables TLS on the MySQL connection (both the app and the TypeORM migration CLI). `true` turns it on, unset/blank/`false` leaves it off (local dev and tests); any other value fails boot. Certificates are always verified (`rejectUnauthorized: true`, not configurable). Boot fails when `NODE_ENV=production` and this is not `true` — the guard keys on `NODE_ENV` like the CORS `*` guard, so production must set `NODE_ENV=production`. | `backend/src/database/mysql-ssl.ts`, `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `WARD_MYSQL_SSL_CA` | **Consumed**, optional | CA certificate (PEM) used to verify the MySQL server when its certificate isn't signed by a public CA. Written on one line with literal `\n` sequences in place of newlines (they are converted back at boot). Ignored when `WARD_MYSQL_SSL` is off; when unset, Node's default CA bundle is used. | `backend/src/database/mysql-ssl.ts` |
| `WARD_TEST_MYSQL_HOST` | **Consumed**, integration suite only | Host of the throwaway MySQL database used by `yarn test:integration` (`mysql_test` in docker-compose, `127.0.0.1` in CircleCI's `backend_integration`). Never read by `data-source.ts`, `AppModule`, `yarn test` or `yarn coverage`. | `backend/src/database/tests/integration/` |
| `WARD_TEST_MYSQL_PORT` | **Consumed**, integration suite only | ditto (`3306`) | `backend/src/database/tests/integration/` |
| `WARD_TEST_MYSQL_USER` | **Consumed**, integration suite only | ditto (`ward`) | `backend/src/database/tests/integration/` |
| `WARD_TEST_MYSQL_PASSWORD` | **Consumed**, integration suite only | ditto (`ward`) | `backend/src/database/tests/integration/` |
| `WARD_TEST_MYSQL_NAME` | **Consumed**, integration suite only | ditto (`ward_test`) | `backend/src/database/tests/integration/` |
| `WARD_DEMO_PASSWORD` | **Consumed**, dev/seed-only | Password for the `demo` user seeded by the demo-seed migration. Falls back to a non-working placeholder (`ward-demo-placeholder`) if unset, so the real dev password only exists in `.env`/`.env.dev.sample`, never in source. | `backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts` |
| `WARD_ALLOWED_ORIGINS` | **Consumed**, optional | Credentialed CORS allowlist (`credentials: true`), resolved once at boot. Comma-separated list of bare origins — `scheme://host[:port]`, `http`/`https` only, no path, query, fragment or trailing slash (e.g. `https://app.example.com,http://localhost:3000`); whitespace is trimmed, empty entries are rejected. Takes precedence over `FRONTEND_BASE_URL`. `*` (must be the sole entry) reflects any request origin and is dev-only — boot fails with it when `NODE_ENV=production`. Any malformed entry fails boot with an error naming the variable and the entry. When both this and `FRONTEND_BASE_URL` are unset/blank, CORS stays disabled (same-origin only). The same resolved list also defines the origins `OriginGuard` trusts for cross-site `POST`/`PUT`/`PATCH`/`DELETE` (CSRF) — see `docs/agents/architecture/security.md` — so adding an origin here is a trust change, not just a CORS tweak. | `backend/src/core/cors-config.ts`, `backend/src/core/origin.guard.ts`, `backend/src/main.ts` |
| `FRONTEND_BASE_URL` | **Consumed** | Base URL for password-reset links, and the CORS allowlist fallback: when `WARD_ALLOWED_ORIGINS` is unset/blank, CORS allows only this URL's origin (path dropped), and `OriginGuard` trusts that same origin for CSRF. An unparseable or non-http(s) value fails boot. | `backend/src/auth/password-reset.service.ts`, `backend/src/core/cors-config.ts`, `backend/src/core/origin.guard.ts` |
| `WARD_EMAILS_ENABLED` | **Consumed**, optional | Master toggle; `'true'` enables outbound sending, anything else (default) disables it (log-and-skip). | `backend/src/mail/mail.config.ts`, `backend/src/mail/mail.module.ts` |
| `WARD_EMAIL_HOST` | **Consumed** (required when enabled) | SMTP host. Boot throws if enabled without it. | `backend/src/mail/mail.config.ts` |
| `WARD_EMAIL_PORT` | **Consumed**, optional | SMTP port; defaults to `587`. `465` ⇒ implicit TLS (`secure`); other ports ⇒ STARTTLS when `WARD_EMAIL_USE_TLS`. | `backend/src/mail/mail.config.ts` |
| `WARD_EMAIL_USER` | **Consumed**, optional | SMTP auth username. `auth` is sent only when both user and password are set. | `backend/src/mail/mail.config.ts` |
| `WARD_EMAIL_PASSWORD` | **Consumed**, optional | SMTP auth password. | `backend/src/mail/mail.config.ts` |
| `WARD_EMAIL_USE_TLS` | **Consumed**, optional | Forces a STARTTLS upgrade on non-465 ports. Defaults to `true`. `WARD_EMAIL_USE_TLS=false` is ignored (STARTTLS still required) when SMTP credentials are configured. | `backend/src/mail/mail.config.ts` |
| `WARD_EMAIL_FROM` | **Consumed** (required when enabled) | Default `From:` address. Must be one the SMTP server is authorized to send as (SPF/DKIM). | `backend/src/mail/mail.config.ts` |
| `WARD_EMAIL_TIMEOUT_MS` | **Consumed**, optional | Bounds nodemailer's connection/greeting/socket timeouts. Defaults to `10000`. | `backend/src/mail/mail.config.ts` |
| `WARD_EMAIL_METHOD` | **Consumed**, optional | Selects the `EmailMethod` `MailService#sendEmail` delivers through (currently only `native`, the nodemailer transport). Defaults to `native`. Boot throws if set to an unregistered name. | `backend/src/mail/mail.config.ts` |
| `BANK_DEFAULT_CURRENCY` | **Consumed**, optional | ISO 4217 code applied when an account create request omits `currency`, and returned by `GET <base>/settings.json` (`default_currency`) for the create form. Trimmed; defaults to `BRL` when unset/blank. Validated at boot against `Intl.supportedValuesOf('currency')` — an unsupported code fails startup. | `backend/src/bank/bank.config.ts`, `backend/src/bank/bank-config.module.ts` |
| `WARD_LOG_LEVEL` | **Consumed**, optional | Log-level threshold (`debug`/`info`/`warn`/`error`) for the Core logger service; defaults to `info` when unset. | `backend/src/core/logger.service.ts` |

**Device-authorization tuning — undocumented-but-defaulted in dev.** None of the six
`WARD_AUTHORIZATION_REQUEST_*` variables above (TTL plus the five rate-limit/cap/cool-off keys)
are set in `.env.dev.sample` — local dev runs entirely on their code-level defaults (see each
row above). Set them explicitly only if a deployment needs different tuning.

### Rotating `WARD_SECRET_KEY`

Keys must not contain commas, and must not have leading or trailing whitespace. Entries in
`WARD_PREVIOUS_SECRET_KEYS` are trimmed, so a padded key would no longer match the value
that signed the old tokens.

**Routine rotation (zero downtime).** Use this only when the old key is *not* suspected to be
compromised:

1. Generate a new long random key.
2. Deploy with `WARD_SECRET_KEY=<new>` and `WARD_PREVIOUS_SECRET_KEYS=<old>`. New access
   tokens are signed with `<new>`; tokens already issued with `<old>` keep verifying.
3. Wait at least `WARD_ACCESS_TOKEN_TTL_MS` (default 15 minutes), counted from the moment
   *every* backend instance runs the new config (instances still on the old config keep signing
   with `<old>`), so every access token signed with `<old>` has expired.
4. Deploy again with `<old>` removed from `WARD_PREVIOUS_SECRET_KEYS`.

If Ward runs several backend instances behind a rolling deploy, old instances would reject tokens signed with `<new>` during the rollout. Use three
phases instead: (a) `WARD_SECRET_KEY=<old>`, `WARD_PREVIOUS_SECRET_KEYS=<new>`; (b)
`WARD_SECRET_KEY=<new>`, `WARD_PREVIOUS_SECRET_KEYS=<old>`; (c) remove `<old>`.

**Compromised key.** Do not list the leaked key in `WARD_PREVIOUS_SECRET_KEYS`, because
anyone holding it could keep forging access tokens until it is removed. Deploy the new
`WARD_SECRET_KEY` with the old key dropped entirely. Every outstanding access token is
rejected at once. Clients recover through the refresh flow, because refresh tokens do not
depend on the key.

Side effects (both variants):

- The cache token is always derived from the current key only, so it changes on the first
  deploy. That only causes cache misses.
- Refresh tokens are random values stored as SHA-256 hashes and do not depend on the key, so
  they are unaffected.

## 2. Proxy (production)

The production Tent proxy needs **no environment variables** — its config comes entirely from
`proxy/prod_configuration/locals.php` (real file gitignored; `locals.php.sample` is the
committed template), which is generated directly on the SSH host, not read from `.env.prod`.
`FRONTEND_DEV_MODE` only matters in `proxy/dev_configuration/` (local dev's Vite-vs-static
toggle) — don't look for a production equivalent, there isn't one.

## 3. Cache warmer (Navi)

Used by the `ward_navi` compose service and the Navi scripts (`scripts/warm_navi_cache.sh`,
`scripts/wake_navi.sh`). No CircleCI job warms the cache yet (see `docs/agents/cache-warmer.md`):

| Variable | Purpose | Source |
|---|---|---|
| `WARD_PRODUCTION_URL` | Base URL Navi warms requests against. | `navi/resources/clients.yml`, `docker-compose.yml` |
| `NAVI_NAMEPACE` | Navi cache namespace. | `navi/resources/clients.yml`, `scripts/warm_navi_cache.sh` |
| `NAVI_PORT` | Port Navi's own web UI listens on locally (`3100` in dev). | `navi/navi_config.yaml`, `docker-compose.yml` |

## 4. CircleCI project variables (deploy pipeline)

Not part of any `.env` file — set directly in CircleCI's project (or org) settings, consumed as
plain shell env vars by `scripts/`/`bin/` and the image-provided `deploy_frontend.sh` during CI
jobs. `.circleci/config.yml`'s release chain (`build-and-release`, `upload_proxy_files`,
`upload_extension`, `copy_proxy_configuration`, `upload_fe_files`, `release`), gated to semver tag
pushes, needs every variable below except the Navi, `WARD_NAMESPACE` and `CODACY_PROJECT_TOKEN`
rows. Filling them in is part of the one-time manual setup — see the
[provisioning checklist](deployment.md#provisioning-checklist) in `deployment.md`, which also
says how to get each value.

| Variable | Purpose | Used by |
|---|---|---|
| `DOCKER_ID_USER` | Docker Hub namespace the four base images (`ward-base`, `circleci_ward-base`, `production_ward-base`, `vite_ward-base`) are pushed to. The backend app image is never published — Render builds it (see `docs/agents/deployment.md`). | `bin/image.sh` (`release-image`) |
| `DOCKER_HUB_USERNAME` / `DOCKER_HUB_PASSWORD` | Docker Hub login for pushing the base images. | `bin/image.sh` (`release-image`) |
| `RENDER_API_KEY` | Authenticates Render API calls (repoint the deploy branch, trigger and watch the deploy). | `scripts/render.sh` (`build-and-release`) |
| `RENDER_SERVICE_NAME` | Which Render service to deploy (defaults to `ward`); no service with that name fails the job. | `scripts/render.sh`, `scripts/deploy.sh` (`build-and-release`) |
| `SSH_HOST` / `SSH_PORT` / `SSH_USER` | Connection to the SSH deploy host (proxy + static files). | `deploy_frontend.sh` (image-provided, `darthjee/scripts:0.12.0`), every SSH job |
| `SSH_PRIVATE_KEY` | Deploy-only private key for that host. | `deploy_frontend.sh generate_key_file`, run by the `setup_ssh` command in every SSH job |
| `SSH_KNOWN_HOSTS` | Pinned host key(s) of the deploy host (`ssh-keyscan -p <port> <host>` output); SSH runs with `StrictHostKeyChecking=yes`. Required: the `setup_ssh` CircleCI command fails when it is empty. | `setup_ssh` + `deploy_frontend.sh`, every SSH job |
| `SSH_REMOTE_DIR` | Live path on the deploy host, swapped on release (the previous release is kept as `${SSH_REMOTE_DIR}_old_<epoch>`). | `deploy_frontend.sh` (`copy_proxy_configuration`, `release`) |
| `SSH_REMOTE_TEMP_DIR` | Prefix of the workflow's staging directory (`${SSH_REMOTE_TEMP_DIR}-${CIRCLE_WORKFLOW_WORKSPACE_ID}`); stale `${SSH_REMOTE_TEMP_DIR}-*` directories are removed by `cleanup`. | `deploy_frontend.sh`, every SSH job |
| `NAVI_URL` | Navi server URL for cache warm-up and wake calls. | `scripts/warm_navi_cache.sh`, `scripts/wake_navi.sh` — not run by any CircleCI job yet (see `docs/agents/cache-warmer.md`). |
| `NAVI_API_TOKEN` | Auth token for Navi's `navi-client`. | `scripts/warm_navi_cache.sh` — not run by any CircleCI job yet. |
| `WARD_NAMESPACE` | Combined with the CircleCI workspace ID to build a per-build Navi namespace. | Not yet consumed — reserved for a future `warm-up-cache` job (cache warm-up is out of scope for the current release chain; see `docs/agents/cache-warmer.md`). |
| `CODACY_PROJECT_TOKEN` | Coverage upload target, read implicitly by Codacy's own uploader script. | `backend_tests`/`jasmine` CI jobs |

`CIRCLE_WORKFLOW_WORKSPACE_ID` is set by CircleCI itself and suffixes the staging directory. The
per-call `deploy_frontend.sh` variables (`SOURCE`, `DEPLOY_PATH`, `TARGET`, `EXCLUDE_FROM`,
`KEEP_OLD`, `CLEANUP_MAX_AGE_MINUTES`) are set inline in `.circleci/config.yml`, not in the
project settings — see `docs/agents/deployment.md`. The Render service itself needs the backend
runtime variables of §1; the SSH host needs no environment variables (§2).

## Keeping this doc honest

If you add code that reads a new `process.env.*` / `getenv()` value, or wire up a var currently
marked "Reserved, not yet read," update its row here in the same change — this doc is only useful
if it matches what the code actually does.
