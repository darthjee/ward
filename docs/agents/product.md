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
| [Bank](modules/bank.md) | Lazy | Bank accounts, business expenses to send to the accountant, bills to pay | Implemented (Calendar views pending [#77](https://github.com/darthjee/ward/issues/77)) |
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

- **Domain data ownership**: every domain record belongs to exactly one user **or**
  organization, stored as logical references to Auth (no cross-module FK). Each module declares
  one kind:
  - **user-owned** (the default; the planned `protocol`, `car-performance`, `links`) — each
    record belongs to one user through a logical `userId`, and only that user reads or changes
    it;
  - **user-or-organization-owned** (`bank`) — each owner-root record has exactly one owner,
    either a user (Personal) or an [organization](modules/auth/organizations.md), stored as two
    nullable logical references with a DB check that exactly one is set; child records inherit
    the owner. Personal records are visible to their owner only; organization records to every
    member of that organization.

  Organizations are optional (none is created at registration), their roles are stored but not
  enforced, and the active context lives in the URL. Admin tooling covers **accounts only** — it
  grants no access to anyone's personal data nor to any organization's data. See
  [Organizations → Data ownership](modules/auth/organizations.md#data-ownership). A module that
  needs any other kind of sharing must decide and document it explicitly.

## Implemented domain modules

### `bank`

Tracks bank accounts, business expenses handed to the accountant, and bills to pay. Decided by
Epic [#26](https://github.com/darthjee/ward/issues/26) and documented in
[Bank](modules/bank.md):

- one `Account` entity with four types (`regular`, `debt`, `investment`, `provider_expense`),
  each with a ledger whose balance is computed from an opening anchor and the transactions;
- one currency per account, amounts in integer minor units, totals grouped per currency and
  never summed;
- business expenses are the charges of `forAccountant` provider-expense accounts, handed off as
  a client-side CSV and marked as sent;
- bills are derived from debt / provider-expense schedules, plus one-off bills; paying one
  writes ledger transactions in one DB transaction;
- user-or-organization-owned (see Domain data ownership above).

The concerns it deferred are open GitHub epics, linked from each `modules/bank/` page.

## Planned modules — what is known and what is open

Only the purpose of each planned module is decided. Entities, fields, routes and rules are
decided in each module's own issue and recorded in `modules/<name>.md`.

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
  modules involved exist. Bill reminders and a cross-module calendar are tracked as epics
  [#99](https://github.com/darthjee/ward/issues/99) and
  [#98](https://github.com/darthjee/ward/issues/98).
- **Bank and organization follow-ups** — every concern deferred by the bank and organization
  specs is an open epic (#81–#104), linked from the page of [Bank](modules/bank.md) or
  [Organizations](modules/auth/organizations.md) that mentions it.

## What's still open

- Everything listed as "Open" under each planned module above.
- Roles beyond regular user/admin (none planned so far). Organization roles (`owner` / `admin`
  / `user`) are stored but not enforced until the permission-system epic
  ([#81](https://github.com/darthjee/ward/issues/81)).

## When a module is specified

- Create `modules/<name>.md` (and its routes page) and move the module's "Known/Open" notes there.
- Update the module's row above (link + status) and in
  [Modular Pattern](architecture/modular-pattern.md#planned-modules).
- Write down its access rules in its module page (or in a dedicated `access-control.md` once
  several modules need cross-cutting rules), and point `.claude/agents/data-access.md` at it.
