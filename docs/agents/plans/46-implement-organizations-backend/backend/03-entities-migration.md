# Entities, migration and test registries
Add the two `auth` entities and their migration.

- **`backend/src/auth/entities/organization.entity.ts`**: `@Entity('auth_organizations')`.
  - `id`;
  - `name`: `varchar(255)`, not unique;
  - `createdAt` / `updatedAt` (`created_at` / `updated_at`).
- **`backend/src/auth/entities/organization-membership.entity.ts`**:
  `@Entity('auth_organization_memberships')`.
  - `id`;
  - `organizationId` (`organization_id`, int) and `userId` (`user_id`, int);
  - `role`: `varchar(16)`, typed through a `MembershipRole` const object + type (`owner` /
    `admin` / `user`), like `UserStatus`;
  - timestamps;
  - a unique `@Index(['organizationId', 'userId'], { unique: true })`.

  Keep plain id columns, as elsewhere in the codebase. The FKs live in the migration.
- **Migration** `backend/src/database/migrations/<next-timestamp>-auth-create-organizations.ts`,
  class `AuthCreateOrganizations<timestamp>`, built with the helpers (`idColumn()`,
  `createdAtColumn()`, `updatedAtColumn()`):
  - `up`:
    - create `auth_organizations`;
    - create `auth_organization_memberships` with real `TableForeignKey`s to
      `auth_organizations.id` and `auth_users.id` (the first physical FKs in the codebase);
    - add the unique index `idx_auth_organization_memberships_organization_id_user_id`;
    - add an index on `user_id` for "list my orgs".
  - `down`: drop memberships first, then organizations.
  - Use the next timestamp after the latest existing migration.
- **Test registries**:
  - add the migration to `MIGRATIONS` and the entities to `ENTITIES` in
    `backend/src/database/tests/integration/test-data-source.ts`;
  - add both tables to the hard-coded list in `migrations-round-trip.integration-spec.ts`.
- **Tests**:
  - migration unit spec with the fake query runner (`backend/src/database/tests/`);
  - integration spec (`backend/src/database/tests/integration/`) checking the columns, the FKs
    and that the unique `(organization_id, user_id)` constraint rejects a duplicate.

## Files to Change
- `backend/src/auth/entities/organization.entity.ts` — new
- `backend/src/auth/entities/organization-membership.entity.ts` — new, plus `MembershipRole`
- `backend/src/database/migrations/<timestamp>-auth-create-organizations.ts` — new
- `backend/src/database/tests/integration/test-data-source.ts` — register the migration and entities
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts` — new tables
- `backend/src/database/tests/auth-create-organizations-migration.spec.ts` — unit spec
- `backend/src/database/tests/integration/organizations-schema.integration-spec.ts` — schema and unique constraint
