# Lazy `BankModule`: account type registry and account service

Create the lazy module and the generic account logic. The module must never name a specific
account type outside its handler.

## `bank/bank.module.ts`

- Imports `TypeOrmModule.forFeature([Account, Transaction])` and `BankConfigModule`.
- Provides the services below.
- `AppModule` must **never** import it.

## Type extension point (`bank/account-types/`)

### `AccountTypeHandler` interface

| Member | Purpose |
|---|---|
| `type: string` | The account type the handler serves. |
| `carriesLedger: boolean` | Whether accounts of this type have a ledger. |
| `validateCreate(nested: unknown)` / `validateUpdate(nested: unknown)` | Validate the type's nested body object (`debt`, `investment`, `provider_expense`). `regular` accepts none. |
| `loadDetails(accountIds, manager)` / `saveDetails(account, nested, manager)` | Load and save the type's one-to-one details row. No-ops for `regular`. |
| `serialize(details)` | Returns the nested response object, or `undefined`. |

### Registry and the `regular` handler

- `AccountTypeRegistry` is keyed by `type`, through a multi-provider token such as
  `ACCOUNT_TYPE_HANDLERS`, so later types register one more provider.
- `get(type)` throws a 400 for an unknown type.
- `RegularAccountHandler` has no details table and `carriesLedger: true`.

## DTOs (`bank/dto/`)

### `CreateAccountDto`

| Field | Rule |
|---|---|
| `type` | Optional, default `'regular'`. |
| `name` | Required, trimmed, non-blank, at most 255 characters. |
| `bank_name`, `branch`, `account_number` | Optional, at most 64 characters each. |
| `currency` | Optional; must be supported. |
| `opening_date` | Optional, defaults to today in UTC; must be at most UTC today + 1 day. |
| `opening_balance` | Optional decimal string, default `"0"`. |
| `notes` | Optional, at most 2000 characters. |

Owner fields, ids and computed fields are absent, so `@StrictBody()` rejects them.

### `UpdateAccountDto`

- The same editable fields, all optional.
- No `type` field, so the strict pipe rejects it with a 400.

DTO properties use `snake_case`, matching the organization routes.

## `AccountService`

Every query is scoped with `ownerWhere(owner)` plus the id. A wrong context or an unknown id
throws `ownerNotFound()`.

- **`list(owner, { type = 'regular', archived = false })`:**
  - sorted by name;
  - archived accounts are excluded unless `archived=true`, and are marked when shown;
  - the current balance of every account comes from **one** grouped query
    (`SUM(amount) … WHERE date >= opening_date GROUP BY account_id`), never one query per
    account;
  - `account_number` is masked server-side as `•••• ` plus the last 4 characters.
- **`find(owner, id)`:** the full account number and the current balance.
- **`create(owner, dto)`:**
  - resolves the handler through the registry, so any type without a handler gets a 400;
  - applies `BANK_DEFAULT_CURRENCY` when `currency` is omitted;
  - parses `opening_balance` with the currency exponent;
  - sets `userId` or `organizationId` from the owner context only;
  - maps `ER_DUP_ENTRY` (errno 1062) to 409.
- **`update(owner, id, dto)`:**
  - on an archived account only `name` is accepted; any other field gets a 409;
  - changing `currency` while the account has transactions gets a 409;
  - the opening anchor (`opening_date`, `opening_balance`) is editable;
  - a duplicate name gets a 409.
- **`archive` / `unarchive`:** unarchive maps a duplicate name to 409.
- **`delete`:**
  - answers 409 when the account has transactions, with a message pointing to archive;
  - also maps the FK `ER_ROW_IS_REFERENCED_2` (errno 1451) to the same 409, to cover the race.
- **`serializeAccount`:**
  - `snake_case` output: `id`, `type`, `name`, `bank_name`, `branch`, `account_number`,
    `currency`, `opening_date`, `opening_balance`, `balance`, `archived_at`, `notes`,
    `created_at` and `updated_at`, plus the handler's nested object;
  - it **never** includes `user_id` or `organization_id`;
  - amounts are formatted with `formatAmount`.
- Add the new conflict codes to `core/error-codes.ts`:
  - `ACCOUNT_NAME_TAKEN`;
  - `ACCOUNT_HAS_TRANSACTIONS`;
  - `ACCOUNT_ARCHIVED`;
  - `CURRENCY_LOCKED`.

## Tests

Unit specs with fake repositories covering:

- the registry rejecting a type with no handler;
- the defaults (`type`, `currency`), trimming and the length limits;
- owner scoping: queries always carry `ownerWhere`, and a wrong-context id gets a 404;
- the 409 mappings: name clash, archived edits, currency lock, delete with transactions and
  the FK race;
- masking;
- the absence of owner fields in the serialiser;
- the single grouped balance query.

## Files to Change

- `backend/src/bank/bank.module.ts` — new: the lazy module.
- `backend/src/bank/account-types/account-type-handler.ts` — new: interface and `ACCOUNT_TYPE_HANDLERS` token.
- `backend/src/bank/account-types/account-type.registry.ts` — new.
- `backend/src/bank/account-types/regular-account.handler.ts` — new.
- `backend/src/bank/dto/create-account.dto.ts` — new.
- `backend/src/bank/dto/update-account.dto.ts` — new.
- `backend/src/bank/dto/list-accounts-query.dto.ts` — new: `type` and `archived`.
- `backend/src/bank/account.service.ts` — new.
- `backend/src/bank/account-response.ts` — new: serialiser and masking.
- `backend/src/core/error-codes.ts` — add the bank conflict codes.
- `backend/src/bank/tests/account-type.registry.spec.ts` — new.
- `backend/src/bank/tests/account.service.spec.ts` — new.
- `backend/src/bank/tests/account-response.spec.ts` — new.
