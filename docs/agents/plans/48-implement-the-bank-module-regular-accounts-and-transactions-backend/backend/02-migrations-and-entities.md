# Migrations, entities and schema integration specs

Create the two `bank_` tables and their entity classes, and prove the DB-level rules against
real MySQL.

## Migrations

Follow the existing naming: a timestamp after `20261107120015`, and the class name ends with
the timestamp. Use the `idColumn()`, `createdAtColumn()` and `updatedAtColumn()` helpers.

### `<ts>-bank-create-accounts.ts` — table `bank_accounts`

- **Columns:**
  - `id`;
  - `user_id INT NULL` and `organization_id INT NULL`, both logical references with no FK;
  - `type VARCHAR(32) NOT NULL`;
  - `name VARCHAR(255) NOT NULL`;
  - `bank_name`, `branch` and `account_number`, each `VARCHAR(64) NULL`;
  - `currency CHAR(3) NOT NULL`;
  - `opening_date DATE NOT NULL`;
  - `opening_balance BIGINT NOT NULL DEFAULT 0`;
  - `archived_at DATETIME NULL`;
  - `notes TEXT NULL`, with the 2000-character limit enforced in validation;
  - `created_at` and `updated_at`.
- **Generated column:** `active_name_key`, `VIRTUAL` or `STORED`, defined as
  `IF(archived_at IS NULL, LOWER(name), NULL)`, with the explicit collation
  `utf8mb4_0900_as_cs` (see the Notes in [../backend.md](../backend.md)).
- **Unique indexes:** `(user_id, active_name_key)` and `(organization_id, active_name_key)`.
  They also serve as the owner lookup indexes.
- **Check constraint:** a `TableCheck` named `bank_accounts_exactly_one_owner`, with
  `(user_id IS NULL) <> (organization_id IS NULL)`.
- `down` drops the table.

### `<ts+1>-bank-create-transactions.ts` — table `bank_transactions`

- **Columns:**
  - `id`;
  - `account_id INT NOT NULL`;
  - `date DATE NOT NULL`;
  - `amount BIGINT NOT NULL`;
  - `description VARCHAR(255) NOT NULL`;
  - `notes TEXT NULL`;
  - `created_at` and `updated_at`.
- **Foreign key:** `account_id → bank_accounts.id ON DELETE RESTRICT`.
- **Index:** `(account_id, date, id)`.
- `sent_to_accountant_at` is **not** added here; it belongs to #54.

## Entities (`bank/entities/`)

- **`Account`:**
  - The properties `userId` and `organizationId` must use exactly those names, because
    `ownerWhere()` depends on them.
  - `openingBalance` and `amount` get a `bigint` transformer, since mysql2 returns `BIGINT` as a
    string.
  - `active_name_key` is either not mapped, or mapped with `insert: false, update: false`.
  - It has no relation to the auth entities.
- **`Transaction`:** a `ManyToOne` to `Account`, or just `accountId` with the FK left to the
  migration. Keep it minimal.

Register both entities with the root TypeORM configuration by declaring
`TypeOrmModule.forFeature([Account, Transaction])` in a **resident** module (`BankRoutesModule`,
step 06). `autoLoadEntities` then picks up their metadata at boot. Until step 06 exists, a
temporary resident `forFeature` in `AppModule` is acceptable if needed.

## Tests

- **Migration unit specs**, using `fakeQueryRunner`: check the columns, indexes, check, FK and
  `down`.
- **`test-data-source.ts`:** register both migrations in order in `MIGRATIONS`, and add both
  entities to `ENTITIES`.
- **`migrations-round-trip.integration-spec.ts`:** also assert that a full down leaves no
  `bank_` tables and a full up creates exactly the expected `bank_` tables.
- **New `bank-schema.integration-spec.ts`** (raw `ds.query`):
  - the check rejects a row with both owners or with neither;
  - a case-insensitive active-name clash is rejected within one user and within one
    organization;
  - the same name is allowed in a user and an organization, and in two organizations;
  - an archived name never clashes;
  - "Itaú" and "Itau" do not clash;
  - deleting an account that has transactions is refused by the FK;
  - the `(account_id, date, id)` index exists.

## Files to Change

- `backend/src/database/migrations/<ts>-bank-create-accounts.ts` — new.
- `backend/src/database/migrations/<ts+1>-bank-create-transactions.ts` — new.
- `backend/src/bank/entities/account.entity.ts` — new.
- `backend/src/bank/entities/transaction.entity.ts` — new.
- `backend/src/database/tests/bank-create-accounts-migration.spec.ts` — new.
- `backend/src/database/tests/bank-create-transactions-migration.spec.ts` — new.
- `backend/src/database/tests/fake-query-runner.ts` — add `createCheckConstraint` to `METHODS` only if it is used outside `createTable`.
- `backend/src/database/tests/integration/test-data-source.ts` — register the migrations and entities.
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts` — add the `bank_` assertions.
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — new.
