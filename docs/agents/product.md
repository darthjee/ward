# Product Definitions

The canonical place for the `product-owner`, `data-access`, and `security` agents to check "is
this decided yet?" — anything not listed here (or in a module's page under `modules/`) should be
treated as undecided and flagged.

## What Ward is

Ward is a personal web application for organising everyday life. Instead of a scattered set of
spreadsheets, notes and bookmarks, each life-admin concern becomes a **module** of one
application: one login, one UI, one database, one deployment. Modules are independent and are
added one at a time, so Ward grows as new needs show up.

- **Users**: built for a single user first (the owner), but multi-user from the start —
  accounts, admin approval of registrations and per-user data isolation are all in place.
- **Hosting**: one Render free-tier service (512 MB RAM) behind the Tent caching proxy — see
  [Architecture](architecture.md#hosting-constraints).

## Modules

| Module | Tier | Purpose | Status |
|---|---|---|---|
| [Auth](modules/auth.md) | Always-on | Accounts, login, sessions, device authorization, user approval, admin user tooling | Implemented |
| [Mail](modules/mail.md) | Always-on (service-only) | Transactional email (e.g. password recovery) | Implemented |
| `bank` | Lazy | Bank accounts, business expenses to send to the accountant, bills to pay | Planned |
| `protocol` | Lazy | Protocol numbers of requests made to companies (support tickets, complaints, service calls) | Planned |
| `car-performance` | Lazy | Fuel consumption and cost per car | Planned |
| `links` | Lazy | Links saved to check later | Planned |

More modules will follow. Each one gets its own page under `modules/` once specified (see
[Modular Pattern](architecture/modular-pattern.md#what-a-module-page-must-contain)).

## Cross-cutting decisions

- **Accounts and login**: users log into Ward with username/password, backed by a JWT
  `access_token` cookie and a rotating refresh token, either directly or by having an
  already-logged-in device approve the login through the device-authorization flow (see
  [Auth](modules/auth.md) and [Flow](flow.md)).
- **User approval**: every account carries a status, `pending`, `approved` or `denied`, and
  **only `approved` accounts are authenticated**. Admin approval of new self-registrations is
  optional (`WARD_USER_APPROVAL_REQUIRED`, off by default); it only decides the
  status a new registration starts with. Admins review accounts from the admin users page: they
  approve `pending` accounts and deny any account except their own (**admins may deny other
  admins**; only self-deny is refused). `denied` is final: un-deny is **rejected** as a
  feature, not postponed, and only a manual DB change leaves `denied`. See
  [User approval](modules/auth/user-approval.md).
- **Admin tooling**: narrowly-scoped admin UI/endpoints are allowed, gated behind the admin role
  and `@AdminOnly()` — this is not general admin-panel scaffolding.
- **Transactional email**: sent through the always-on [Mail](modules/mail.md) module (disabled
  by default; log-and-skip).
- **Env vars for the framework**: simple env-driven config, read once at boot (no hidden env
  reads inside classes) — `WARD_SECRET_KEY` (session/cookie signing), `WARD_ALLOWED_ORIGINS`
  (CORS allowlist, falling back to `FRONTEND_BASE_URL`'s origin — format and production wildcard
  rule in [Environment Variables](environment-variables.md)),
  `WARD_USER_APPROVAL_REQUIRED` (new registrations start `pending` when exactly
  `true`), `NODE_ENV`/`DEBUG`.

- **Domain data ownership**: every domain record (a bank account, a protocol, a car, a link,
  …) belongs to exactly one user, stored as a logical `userId` reference to Auth. A user only
  ever reads or changes their own records. Admin tooling covers **accounts only** — it does not
  grant access to other users' domain data. A module that needs sharing must decide and document
  it explicitly.

## Planned modules — what is known and what is open

Only the purpose of each planned module is decided. Entities, fields, routes and rules are
decided in each module's own issue and recorded in `modules/<name>.md`.

### `bank`

- **Known**: tracks bank accounts, business expenditures (to be collected and sent to the
  accountant) and bills to be paid.
- **Open**: entities (accounts, transactions/expenses, bills, categories?), how expenses are
  handed to the accountant (export format, period), bill due dates/recurrence and whether paying
  a bill creates an expense, currency handling.

### `protocol`

- **Known**: stores the protocol numbers given by companies when a request is made, so they can
  be looked up later.
- **Open**: fields (company, channel, date, subject, protocol number, status, follow-ups?),
  whether a protocol has a history of interactions, attachments.

### `car-performance`

- **Known**: calculates how much fuel a car is using (and what it costs).
- **Open**: entities (cars, refuelling records), which measures (km/l, l/100 km, cost per km),
  partial vs. full tank handling, fuel types, other car costs (maintenance) in or out of scope.

### `links`

- **Known**: keeps links to check later.
- **Open**: fields (URL, title, notes, tags?), read/unread or archive state, whether link
  metadata (title/preview) is fetched automatically.

## Deferred (future, not current scope)

- **User-approval notifications**: approve and deny send no email, and admins are not alerted
  of new pending registrations.
- **Pagination of the admin user listing** (`POST /admin/users/search.json` is unpaginated).
- **Cross-module features** (e.g. a bill in `bank` creating a reminder) — wait until the
  modules involved exist.

## What's still open

- Everything listed as "Open" under each planned module above.
- Roles beyond regular user/admin (none planned so far).

## When a module is specified

- Create `modules/<name>.md` (and its routes page) and move the module's "Known/Open" notes there.
- Update the module's row above (link + status) and in
  [Modular Pattern](architecture/modular-pattern.md#planned-modules).
- Write down its access rules in its module page (or in a dedicated `access-control.md` once
  several modules need cross-cutting rules), and point `.claude/agents/data-access.md` at it.
