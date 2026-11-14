import type { TableColumn } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { AuthAddUsersLocale20261113120024 } from '../migrations/20261113120024-auth-add-users-locale.js';

describe('AuthAddUsersLocale20261113120024', () => {
  const migration = new AuthAddUsersLocale20261113120024();

  it('adds a nullable locale varchar(16) column', async () => {
    const runner = fakeQueryRunner();

    await migration.up(asQueryRunner(runner));

    expect(runner.calls).toEqual(['addColumn']);
    const [table, column] = runner.addColumn.mock.calls[0] as [string, TableColumn];
    expect(table).toBe('auth_users');
    expect([column.name, column.type, column.length, column.isNullable]).toEqual([
      'locale',
      'varchar',
      '16',
      true,
    ]);
  });

  it('drops the column on down', async () => {
    const runner = fakeQueryRunner();

    await migration.down(asQueryRunner(runner));

    expect(runner.dropColumn).toHaveBeenCalledWith('auth_users', 'locale');
  });
});
