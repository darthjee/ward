# Issue: Implement the bank module, regular accounts and transactions — backend

## Description

Create the lazy `bank` backend module with the user-or-organization ownership contract, regular
accounts, the transaction ledger and the settings route.

Part of Epic #26. It depends on #46 (organizations backend, merged), which provides
`@OwnerScopedController()`, `@CurrentOwner()`, `@StrictBody()` and the `OwnerContextGuard`. The
specs are the source of truth: build against them and do not re-decide anything they settle.
When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

- `docs/agents/specs/banking/README.md`: *Decisions*, *Bank ownership contract*.
- `docs/agents/specs/banking/accounts/README.md`.
- `docs/agents/specs/banking/accounts/regular.md`: everything except *Accounts submenu UI* and
  the *Frontend* tests (#49).
- `docs/agents/specs/banking/accounts/transactions.md`: everything except the UI notes and the
  *Frontend* tests (#49).

## Problem

- No domain module exists yet: `bank` is the first one, and the first **lazy** module. The
  lazy pattern is documented (`architecture/modular-pattern.md`,
  `core/lazy-module-loader.service.ts`) but has never been exercised.
- Two technical limits mean the spec's "nothing of `bank` is resident before the first bank
  request" cannot hold literally:
  - Nest registers routes only at boot, so a lazily loaded module cannot declare controllers.
  - TypeORM is configured with `autoLoadEntities: true`, which only sees entities whose
    `forFeature` ran before the `DataSource` initialised. An entity declared only inside a
    lazily imported module has no metadata ("No metadata for …").
- #46 built the owner-context plumbing, but no record-level ownership exists yet: the
  record-level tests of `auth/organizations.md` were moved here from #46.
- The project has no pagination convention yet; the ledger is the first paginated route.

## Expected Behavior

Everything below is specified in the specs listed above; this section only pins the decisions
the specs leave open.

- **Routes** — `OwnerScopedController('bank')` mounts every controller under `bank/...` and
  `orgs/:orgId/bank/...` (the external `/api` prefix is added by the proxy). Account,
  transaction and settings routes, rules, validation, status codes and cache classes as in
  `regular.md` and `transactions.md`.
- **Lazy split** — thin controllers and the entity classes are resident; the services, the
  queries and every piece of business logic live in the lazy `BankModule`, loaded on the first
  bank request through `LazyModuleLoaderService#loadOnFirstRequest()`.
- **Ledger response** — a JSON envelope:

  ```json
  {
    "transactions": [ { "id": 7, "date": "2026-11-01", "amount": "-12.50",
                        "description": "…", "notes": null, "balance": "987.50" } ],
    "opening": { "date": "2026-10-01", "amount": "1000.00", "balance": "1000.00" },
    "pagination": { "page": 1, "per_page": 50, "total_pages": 3, "total_count": 120 }
  }
  ```

  `opening` (the virtual opening row) is present only on the last page, and is `null` on the
  others. A `page` beyond the last answers an empty `transactions` list with the same
  metadata; a non-numeric or `< 1` `page` → 400.
- **Type extension point** — the account routes are generic: each later type (#50 debt,
  #52 investment, #54 provider expense) adds a one-to-one details table and a nested object
  named after the type (`debt`, `investment`, `provider_expense`) on bodies and responses,
  without editing the generic account service.

## Solution

### Module layout (`backend/src/bank/`)

- `bank.module.ts` — the lazy module: `TypeOrmModule.forFeature([Account, Transaction])` and the
  services. Never imported by `AppModule`.
- `bank-routes.module.ts` — resident, imported by `AppModule`: the thin controllers
  (`AccountsController`, `TransactionsController`, `SettingsController`), each declared with
  `@OwnerScopedController('bank')`, reading the owner through `@CurrentOwner()` and bodies only
  through `@StrictBody()`. Each handler loads `BankModule` and delegates to its service.
- `entities/account.entity.ts`, `entities/transaction.entity.ts` — registered with the root
  TypeORM configuration at boot, so their metadata exists before the `DataSource` initialises.
  Entity classes are small; the memory cost that matters (services, queries) stays lazy.
- `BANK_DEFAULT_CURRENCY` is validated at boot (an unsupported code fails startup; unset →
  `BRL`), as `transactions.md` requires.

### Data

- Migrations `<timestamp>-bank-create-accounts.ts` and `<timestamp>-bank-create-transactions.ts`:
  - `bank_accounts` — the common fields, the opening anchor, `type`, the generated
    `active_name_key` column with its two unique indexes, and the exactly-one-owner check
    constraint.
  - `bank_transactions` — the real FK `account_id → bank_accounts.id ON DELETE RESTRICT` and the
    index `(account_id, date, id)`.
- Amounts are `BIGINT` minor units, converted to and from decimal strings with the currency's
  exponent from `Intl.NumberFormat`.

### Type extension point

- An `AccountTypeHandler` interface in the lazy module (validate the type's nested body object,
  load and save its details row, serialise it, report whether the type carries a ledger) and a
  registry keyed by `type`.
- `regular` registers a handler with no details table. Create accepts only types with a
  registered handler, so anything else is 400 until its sub-issue registers one.
- The generic account service calls the registry and never names a specific type.

### Ownership

- Every query filters on the `OwnerContext`: `user_id = ?` for personal, `organization_id = ?`
  for organization, so a wrong-context id is simply not found (404 with the same body as an
  unknown id).
- Owner fields are never serialised; `@StrictBody()` rejects them in bodies.

### Docs

- `architecture/modular-pattern.md` and `core/lazy-module-loader.service.ts` — the
  resident-controller / resident-entity / lazy-service split, now that a lazy module exists.
- `specs/banking/accounts/regular.md` (*Owning module → Lazy loading*) — amend "nothing of
  `bank` is resident before the first bank request" to the same split: the thin controllers
  and entity classes are resident, everything else loads on the first bank request.
- `architecture/backend.md` (*Owned tables*) and a new `backend/routes/bank.md`.
- `modules/bank.md` is created later by the fold issue, as the specs say.

### Tests

Jest only. They cover the *Required tests* (*Backend*) of `regular.md` and `transactions.md`,
including the owner-context matrix, and the record-level tests of `auth/organizations.md` moved
from #46:

- the DB check rejecting both owners or neither;
- wrong context → 404, with the same body as an unknown id;
- owner fields rejected in the body and absent from responses;
- personal routes `user-scoped` with `X-Skip-Cache`;
- a global admin getting no other user's personal data.

Plus:

- `BankModule` is not loaded before the first bank request, and is loaded once afterwards;
- the cache-policy coverage spec passes for every new route;
- the ledger envelope: `opening` only on the last page, out-of-range and invalid `page`;
- the type registry rejects a type with no handler.

### Out of scope

- The frontend (#49).
- Debt, investment and provider-expense accounts (#50, #52, #54) and bills (#56): only the
  extension point is built here.
- `modules/bank.md` and folding the specs (the fold issue).

### Acceptance criteria

- The backend Jest specs and lint pass.
- The `security`, `data-access` and `cache` reviews raise no unresolved violations.

## Benefits

- The first domain module, and the first real lazy module: the pattern every later module
  (`protocol`, `car-performance`, `links`) copies.
- Record-level ownership is enforced and tested once, in the queries, so the later bank types
  inherit it.
- Later account types plug into the generic routes without touching them.
