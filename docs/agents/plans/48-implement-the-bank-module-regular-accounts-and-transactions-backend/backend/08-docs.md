# Documentation

Record the resident and lazy split now that a real lazy module exists, and document the new
tables, routes and env var.

**Ownership:** the backend agent edits only the JSDoc in `lazy-module-loader.service.ts`. Every
`docs/agents/` file and `.env.dev.sample` belong to the **architect**, who makes those edits
after the backend steps are done.

## Backend agent

- **`core/lazy-module-loader.service.ts` docblock:** the thin controllers and the entity
  classes are resident. Entities must be registered through a resident `forFeature`, because
  `autoLoadEntities` only sees entities registered before the `DataSource` initialises.
  Services and queries stay lazy.

## Architect

- **`docs/agents/architecture/modular-pattern.md`:**
  - document the resident-controller / resident-entity / resident-config versus lazy-service
    split, and why it is needed: Nest registers routes only at boot, and `autoLoadEntities`
    behaves as described above;
  - mark `bank` as implemented;
  - update the snippet for loading a lazy module.
- **`docs/agents/specs/banking/accounts/regular.md`** (*Owning module → Lazy loading*): replace
  "nothing of `bank` is resident before the first bank request" with the split. The thin
  controllers, the entity classes and the boot-validated config are resident; everything else
  loads on the first bank request.
- **`docs/agents/architecture/backend.md`** (*Owned tables*): add `bank_accounts` (logical
  `user_id` / `organization_id`, the exactly-one-owner check, the `active_name_key` unique
  indexes) and `bank_transactions` (a real FK to `bank_accounts` with `ON DELETE RESTRICT`).
- **New `docs/agents/backend/routes/bank.md`**, linked from `docs/agents/backend/routes.md`:
  every account, transaction and settings route, with its controller, body, response,
  status codes and cache class, and the ledger envelope and pagination convention.
- **`docs/agents/environment-variables.md`:** a `BANK_DEFAULT_CURRENCY` row (default `BRL`,
  validated at boot against `Intl.supportedValuesOf('currency')`).
- **`.env.dev.sample`:** a commented `BANK_DEFAULT_CURRENCY=BRL` line.
- `modules/bank.md` is **not** created here; the fold issue creates it.

## Files to Change

- `backend/src/core/lazy-module-loader.service.ts` — docblock (backend).
- `docs/agents/architecture/modular-pattern.md` — the split (architect).
- `docs/agents/specs/banking/accounts/regular.md` — the *Lazy loading* amendment (architect).
- `docs/agents/architecture/backend.md` — *Owned tables* (architect).
- `docs/agents/backend/routes/bank.md` — new (architect).
- `docs/agents/backend/routes.md` — link to `bank.md` (architect).
- `docs/agents/environment-variables.md` — `BANK_DEFAULT_CURRENCY` (architect).
- `.env.dev.sample` — `BANK_DEFAULT_CURRENCY` (architect).
