import type { DataSource } from 'typeorm';
import { columnInfo, indexNames, tableNames } from './schema-inspection.js';
import { createTestDataSource, resetDatabase } from './test-data-source.js';

const ORGANIZATIONS = 'auth_organizations';
const MEMBERSHIPS = 'auth_organization_memberships';

async function insertApprovedUser(ds: DataSource, username: string): Promise<number> {
  const result: { insertId: number } = await ds.query(
    'INSERT INTO auth_users (username, email, password_digest, status) VALUES (?, ?, ?, ?)',
    [username, `${username}@example.test`, 'digest', 'approved'],
  );
  return result.insertId;
}

async function insertOrganization(ds: DataSource, name: string): Promise<number> {
  const result: { insertId: number } = await ds.query(`INSERT INTO ${ORGANIZATIONS} (name) VALUES (?)`, [name]);
  return result.insertId;
}

function insertMembership(ds: DataSource, organizationId: number, userId: number, role = 'owner'): Promise<unknown> {
  return ds.query(`INSERT INTO ${MEMBERSHIPS} (organization_id, user_id, role) VALUES (?, ?, ?)`, [
    organizationId,
    userId,
    role,
  ]);
}

describe('AuthCreateOrganizations20261107120015 (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  describe('up', () => {
    it('creates the organizations columns', async () => {
      expect(await columnInfo(ds, ORGANIZATIONS, 'name')).toEqual({
        name: 'name',
        type: 'varchar(255)',
        nullable: false,
        default: null,
      });
      expect(await columnInfo(ds, ORGANIZATIONS, 'created_at')).toMatchObject({ type: 'datetime', nullable: false });
      expect(await columnInfo(ds, ORGANIZATIONS, 'updated_at')).toMatchObject({ type: 'datetime', nullable: false });
    });

    it('creates the memberships columns', async () => {
      expect(await columnInfo(ds, MEMBERSHIPS, 'organization_id')).toMatchObject({ type: 'int', nullable: false });
      expect(await columnInfo(ds, MEMBERSHIPS, 'user_id')).toMatchObject({ type: 'int', nullable: false });
      expect(await columnInfo(ds, MEMBERSHIPS, 'role')).toEqual({
        name: 'role',
        type: 'varchar(16)',
        nullable: false,
        default: null,
      });
    });

    it('creates exactly the declared membership indexes', async () => {
      expect(await indexNames(ds, MEMBERSHIPS)).toEqual([
        'idx_auth_organization_memberships_organization_id_user_id',
        'idx_auth_organization_memberships_user_id',
        'PRIMARY',
      ]);
    });

    it('allows duplicate organization names', async () => {
      await insertOrganization(ds, 'Family');
      await expect(insertOrganization(ds, 'Family')).resolves.toBeGreaterThan(0);
    });

    it('rejects a duplicate (organization_id, user_id) membership', async () => {
      const userId = await insertApprovedUser(ds, 'member');
      const organizationId = await insertOrganization(ds, 'Family');
      await insertMembership(ds, organizationId, userId);

      await expect(insertMembership(ds, organizationId, userId, 'user')).rejects.toThrow(/Duplicate entry/);
    });

    it('allows the same user in two organizations', async () => {
      const userId = await insertApprovedUser(ds, 'member');
      const first = await insertOrganization(ds, 'First');
      const second = await insertOrganization(ds, 'Second');
      await insertMembership(ds, first, userId);

      await expect(insertMembership(ds, second, userId)).resolves.toBeDefined();
    });

    it('rejects a membership of an unknown organization (real FK)', async () => {
      const userId = await insertApprovedUser(ds, 'member');

      await expect(insertMembership(ds, 999999, userId)).rejects.toThrow(/foreign key constraint fails/);
    });

    it('rejects a membership of an unknown user (real FK)', async () => {
      const organizationId = await insertOrganization(ds, 'Family');

      await expect(insertMembership(ds, organizationId, 999999)).rejects.toThrow(/foreign key constraint fails/);
    });

    it('refuses to delete an organization that still has members', async () => {
      const userId = await insertApprovedUser(ds, 'member');
      const organizationId = await insertOrganization(ds, 'Family');
      await insertMembership(ds, organizationId, userId);

      await expect(ds.query(`DELETE FROM ${ORGANIZATIONS} WHERE id = ?`, [organizationId])).rejects.toThrow(
        /foreign key constraint fails/,
      );
    });
  });

  describe('down', () => {
    it('drops both tables, leaving auth_users in place', async () => {
      await ds.undoLastMigration();

      const tables = await tableNames(ds);
      expect(tables).not.toContain(ORGANIZATIONS);
      expect(tables).not.toContain(MEMBERSHIPS);
      expect(tables).toContain('auth_users');
    });
  });
});
