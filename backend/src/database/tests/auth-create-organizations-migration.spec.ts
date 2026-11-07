import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { AuthCreateOrganizations20261107120015 } from '../migrations/20261107120015-auth-create-organizations.js';

function createdTables(runner: ReturnType<typeof fakeQueryRunner>): Table[] {
  return runner.createTable.mock.calls.map(([table]) => table as Table);
}

describe('AuthCreateOrganizations20261107120015', () => {
  const migration = new AuthCreateOrganizations20261107120015();

  describe('up', () => {
    it('creates auth_organizations, then auth_organization_memberships, if missing', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable', 'createTable']);
      expect(createdTables(runner).map((table) => table.name)).toEqual([
        'auth_organizations',
        'auth_organization_memberships',
      ]);
      expect(runner.createTable.mock.calls.map(([, ifNotExist]) => ifNotExist)).toEqual([true, true]);
    });

    it('gives auth_organizations an id, a non-unique varchar(255) name and timestamps', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [organizations] = createdTables(runner);
      expect(organizations.columns.map((c) => [c.name, c.type, c.length, c.isUnique])).toEqual([
        ['id', 'int', '', false],
        ['name', 'varchar', '255', false],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
      expect(organizations.indices).toEqual([]);
    });

    it('gives auth_organization_memberships its columns', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [, memberships] = createdTables(runner);
      expect(memberships.columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['id', 'int', '', false],
        ['organization_id', 'int', '', false],
        ['user_id', 'int', '', false],
        ['role', 'varchar', '16', false],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
    });

    it('adds the unique (organization_id, user_id) index and the user_id index', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [, memberships] = createdTables(runner);
      expect(memberships.indices.map((i) => [i.name, i.columnNames, i.isUnique])).toEqual([
        ['idx_auth_organization_memberships_organization_id_user_id', ['organization_id', 'user_id'], true],
        ['idx_auth_organization_memberships_user_id', ['user_id'], false],
      ]);
    });

    it('adds real FKs to auth_organizations and auth_users', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [, memberships] = createdTables(runner);
      expect(
        memberships.foreignKeys.map((fk) => [fk.columnNames, fk.referencedTableName, fk.referencedColumnNames, fk.onDelete]),
      ).toEqual([
        [['organization_id'], 'auth_organizations', ['id'], 'RESTRICT'],
        [['user_id'], 'auth_users', ['id'], 'RESTRICT'],
      ]);
    });
  });

  describe('down', () => {
    it('drops the memberships (with their FKs and indexes) first, then the organizations', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.dropTable.mock.calls).toEqual([
        ['auth_organization_memberships', true, true, true],
        ['auth_organizations', true],
      ]);
    });
  });
});
