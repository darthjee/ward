import type { INestApplication } from '@nestjs/common';
import {
  ALICE,
  ALICE_ORG,
  base,
  BOB,
  BOB_ORG,
  buildBankTestApp,
  createAccount,
  NOT_FOUND_BODY,
  send,
  withoutTimestamp,
} from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { AccountBalancesQuery } from './support/in-memory-ledger.query.js';
import { createOwnerFixtures, NOT_FOUND_CASES, ownerKeysIn, type OwnerFixtures } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

const TODAY = new Date().toISOString().slice(0, 10);

type Method = 'get' | 'post' | 'patch' | 'delete';

const ACCOUNT_ROUTES: Array<[string, Method, (prefix: string, id: number | string) => string, object?]> = [
  ['GET detail', 'get', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['PATCH', 'patch', (prefix, id) => `${prefix}/accounts/${id}.json`, { notes: 'x' }],
  ['DELETE', 'delete', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['POST archive', 'post', (prefix, id) => `${prefix}/accounts/${id}/archive.json`],
  ['POST unarchive', 'post', (prefix, id) => `${prefix}/accounts/${id}/unarchive.json`],
];

describe('bank account routes (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('owner context', () => {
    it('creates on the personal prefix for the user and on the organization prefix for the organization', async () => {
      const personal = await createAccount(app, ALICE, null, { name: 'Owner check' });
      const organization = await createAccount(app, ALICE, ALICE_ORG, { name: 'Owner check' });

      expect(repos.accounts.rows.find((row) => row.id === personal.id)).toMatchObject({ userId: 7, organizationId: null });
      expect(repos.accounts.rows.find((row) => row.id === organization.id)).toMatchObject({
        userId: null,
        organizationId: ALICE_ORG,
      });
    });

    it('never lists organization accounts on the personal list, nor personal ones on the organization list', async () => {
      const personal = await createAccount(app, ALICE, null);
      const organization = await createAccount(app, ALICE, ALICE_ORG);

      const personalList = await send(app, 'get', '/bank/accounts.json', ALICE).expect(200);
      const organizationList = await send(app, 'get', `/orgs/${ALICE_ORG}/bank/accounts.json`, ALICE).expect(200);
      const ids = (body: Array<{ id: number }>) => body.map((account) => account.id);

      expect(ids(personalList.body)).toContain(personal.id);
      expect(ids(personalList.body)).not.toContain(organization.id);
      expect(ids(organizationList.body)).toContain(organization.id);
      expect(ids(organizationList.body)).not.toContain(personal.id);
    });

    it('never shows another user\'s personal accounts, even to a global admin', async () => {
      const mine = await createAccount(app, ALICE, null);

      const bob = await send(app, 'get', '/bank/accounts.json', BOB).expect(200);
      const admin = await send(app, 'get', '/bank/accounts.json', '9', undefined, true).expect(200);

      expect(bob.body.map((account: { id: number }) => account.id)).not.toContain(mine.id);
      expect(admin.body).toEqual([]);
    });

    it('never returns owner fields', async () => {
      const created = await createAccount(app, ALICE, ALICE_ORG, { account_number: '1234-5' });
      const prefix = `/orgs/${ALICE_ORG}/bank/accounts`;
      const responses = [
        await send(app, 'get', `${prefix}.json`, ALICE),
        await send(app, 'get', `${prefix}/${created.id}.json`, ALICE),
        await send(app, 'patch', `${prefix}/${created.id}.json`, ALICE, { notes: 'n' }),
        await send(app, 'post', `${prefix}/${created.id}/archive.json`, ALICE),
        await send(app, 'post', `${prefix}/${created.id}/unarchive.json`, ALICE),
      ];

      expect(ownerKeysIn(created)).toEqual([]);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(ownerKeysIn(response.body)).toEqual([]);
      });
    });

    describe('uniform 404', () => {
      let fixtures: OwnerFixtures;
      let reference: object;

      beforeAll(async () => {
        fixtures = await createOwnerFixtures(app);
        reference = withoutTimestamp(await send(app, 'get', '/bank/accounts/999999.json', ALICE).expect(404));
      });

      it('has the standard not-found body', () => {
        expect(reference).toEqual({ error: NOT_FOUND_BODY.error, statusCode: 404 });
      });

      describe.each(ACCOUNT_ROUTES)('%s', (_route, method, path, body) => {
        it.each(NOT_FOUND_CASES.map((matrixCase) => [matrixCase.label, matrixCase]))(
          'answers the identical 404 for %s',
          async (_label, { user, admin, orgId, accountId }) => {
            const response = await send(app, method, path(base(orgId), accountId(fixtures)), user, body, admin);

            expect(response.status).toBe(404);
            expect(withoutTimestamp(response)).toEqual(reference);
          },
        );
      });

      it('answers the identical 404 on the list for a non-member :orgId and a non-member global admin', async () => {
        const nonMember = await send(app, 'get', `/orgs/${BOB_ORG}/bank/accounts.json`, ALICE).expect(404);
        const admin = await send(app, 'get', `/orgs/${ALICE_ORG}/bank/accounts.json`, '9', undefined, true).expect(404);
        const create = await send(app, 'post', `/orgs/${BOB_ORG}/bank/accounts.json`, ALICE, { name: 'x' }).expect(404);

        [nonMember, admin, create].forEach((response) => expect(withoutTimestamp(response)).toEqual(reference));
      });

      it('changed nothing', () => {
        expect(repos.accounts.rows.map((row) => row.id)).toEqual(
          expect.arrayContaining([fixtures.alicePersonal, fixtures.aliceOrg, fixtures.bobPersonal, fixtures.bobOrg]),
        );
        expect(repos.accounts.rows.find((row) => row.id === fixtures.bobOrg)?.archivedAt).toBeNull();
      });
    });
  });

  describe('create', () => {
    it('defaults type, currency, opening date and balance, and trims the name', async () => {
      const response = await send(app, 'post', '/bank/accounts.json', ALICE, { name: '  Defaults  ' }).expect(201);

      expect(response.body).toEqual({
        id: expect.any(Number),
        type: 'regular',
        name: 'Defaults',
        bank_name: null,
        branch: null,
        account_number: null,
        currency: 'BRL',
        opening_date: TODAY,
        opening_balance: '0.00',
        balance: '0.00',
        archived_at: null,
        notes: null,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('stores the opening balance in minor units of the currency', async () => {
      const response = await send(app, 'post', '/bank/accounts.json', ALICE, {
        name: 'Yen', currency: 'JPY', opening_balance: '500', opening_date: '2026-01-01',
      }).expect(201);

      expect(response.body).toMatchObject({ currency: 'JPY', opening_balance: '500', balance: '500' });
      expect(repos.accounts.rows.find((row) => row.id === response.body.id)?.openingBalance).toBe(500n);
    });

    it('accepts a 255-character name', async () => {
      await send(app, 'post', '/bank/accounts.json', ALICE, { name: 'n'.repeat(255) }).expect(201);
    });

    it.each([
      ['a type without a handler', { name: 'x', type: 'investment' }],
      ['an unknown type', { name: 'x', type: 'savings' }],
      ['a missing name', {}],
      ['a blank name', { name: '' }],
      ['a whitespace-only name', { name: '   ' }],
      ['a 256-character name', { name: 'n'.repeat(256) }],
      ['a 65-character bank_name', { name: 'x', bank_name: 'b'.repeat(65) }],
      ['a 65-character branch', { name: 'x', branch: 'b'.repeat(65) }],
      ['a 65-character account_number', { name: 'x', account_number: 'b'.repeat(65) }],
      ['2001-character notes', { name: 'x', notes: 'b'.repeat(2001) }],
      ['an unsupported currency', { name: 'x', currency: 'XYZ' }],
      ['too many opening decimals', { name: 'x', opening_balance: '1.005' }],
      ['an unknown field', { name: 'x', color: 'red' }],
      ['userId', { name: 'x', userId: 8 }],
      ['user_id', { name: 'x', user_id: 8 }],
      ['organizationId', { name: 'x', organizationId: 4 }],
      ['organization_id', { name: 'x', organization_id: 4 }],
      ['a computed balance', { name: 'x', balance: '10.00' }],
    ])('rejects %s with a 400', async (_label, body) => {
      const before = repos.accounts.rows.length;

      await send(app, 'post', '/bank/accounts.json', ALICE, body).expect(400);
      expect(repos.accounts.rows.length).toBe(before);
    });
  });

  describe('name uniqueness', () => {
    it('answers 409 on a case-insensitive clash with an active account of the same owner', async () => {
      await createAccount(app, ALICE, null, { name: 'Clash Bank' });

      const response = await send(app, 'post', '/bank/accounts.json', ALICE, { name: 'clash bank' }).expect(409);

      expect(response.body.error.code).toBe('ACCOUNT_NAME_TAKEN');
    });

    it('clashes within one organization', async () => {
      await createAccount(app, ALICE, ALICE_ORG, { name: 'Org Clash' });

      await send(app, 'post', `/orgs/${ALICE_ORG}/bank/accounts.json`, ALICE, { name: 'ORG CLASH' }).expect(409);
    });

    it('allows the same name in Personal and an organization, and in two organizations', async () => {
      await createAccount(app, ALICE, null, { name: 'Shared Name' });

      await createAccount(app, ALICE, ALICE_ORG, { name: 'Shared Name' });
      await createAccount(app, BOB, BOB_ORG, { name: 'Shared Name' });
      await createAccount(app, BOB, null, { name: 'Shared Name' });
    });

    it('never clashes with an archived name, but unarchiving onto an active name answers 409', async () => {
      const old = await createAccount(app, ALICE, null, { name: 'Recycled' });
      await send(app, 'post', `/bank/accounts/${old.id}/archive.json`, ALICE).expect(200);
      await createAccount(app, ALICE, null, { name: 'RECYCLED' });

      const response = await send(app, 'post', `/bank/accounts/${old.id}/unarchive.json`, ALICE).expect(409);

      expect(response.body.error.code).toBe('ACCOUNT_NAME_TAKEN');
    });

    it('answers 409 on a rename clash', async () => {
      await createAccount(app, ALICE, null, { name: 'Taken' });
      const other = await createAccount(app, ALICE, null);

      await send(app, 'patch', `/bank/accounts/${other.id}.json`, ALICE, { name: 'taken' }).expect(409);
    });
  });

  describe('list and detail', () => {
    it('lists regular accounts sorted by name, masked, hiding archived ones unless asked', async () => {
      const zeta = await createAccount(app, BOB, BOB_ORG, { name: 'Zeta', account_number: '0001234' });
      const alpha = await createAccount(app, BOB, BOB_ORG, { name: 'alpha' });
      const gone = await createAccount(app, BOB, BOB_ORG, { name: 'Middle' });
      await send(app, 'post', `/orgs/${BOB_ORG}/bank/accounts/${gone.id}/archive.json`, BOB).expect(200);

      const active = await send(app, 'get', `/orgs/${BOB_ORG}/bank/accounts.json`, BOB).expect(200);
      const all = await send(app, 'get', `/orgs/${BOB_ORG}/bank/accounts.json?archived=true`, BOB).expect(200);
      const names = (body: Array<{ name: string }>) => body.map((account) => account.name);

      expect(names(active.body)).not.toContain('Middle');
      expect(names(active.body).indexOf('alpha')).toBeLessThan(names(active.body).indexOf('Zeta'));
      expect(active.body.find((account: { id: number }) => account.id === zeta.id).account_number).toBe('•••• 1234');
      expect(all.body.find((account: { id: number }) => account.id === gone.id).archived_at).toEqual(expect.any(String));
      expect(names(all.body)).toEqual(expect.arrayContaining(['alpha', 'Middle', 'Zeta']));
      expect(alpha.type).toBe('regular');
    });

    it('computes every list balance with a single grouped query', async () => {
      await createAccount(app, ALICE, null);
      await createAccount(app, ALICE, null);
      const before = AccountBalancesQuery.groupedCalls;

      await send(app, 'get', '/bank/accounts.json', ALICE).expect(200);

      expect(AccountBalancesQuery.groupedCalls - before).toBe(1);
    });

    it('rejects a type without a handler and an invalid archived flag', async () => {
      await send(app, 'get', '/bank/accounts.json?type=investment', ALICE).expect(400);
      await send(app, 'get', '/bank/accounts.json?archived=maybe', ALICE).expect(400);
    });

    it('returns the full account number and the current balance on the detail', async () => {
      const account = await createAccount(app, ALICE, null, {
        account_number: '98765-4', opening_date: '2026-01-01', opening_balance: '100.00',
      });
      await send(app, 'post', `/bank/accounts/${account.id}/transactions.json`, ALICE, {
        date: '2026-01-05', amount: '-25.50', description: 'Groceries',
      }).expect(201);

      const response = await send(app, 'get', `/bank/accounts/${account.id}.json`, ALICE).expect(200);

      expect(response.body).toMatchObject({ account_number: '98765-4', opening_balance: '100.00', balance: '74.50' });
    });
  });

  describe('account_number masking', () => {
    it('masks the number on every write response and returns it in full only on the detail', async () => {
      const masked = '•••• 65-4';
      const prefix = `/orgs/${ALICE_ORG}/bank/accounts`;
      const created = await send(app, 'post', `${prefix}.json`, ALICE, {
        name: 'Masking check', account_number: '98765-4',
      }).expect(201);
      const path = `${prefix}/${created.body.id}`;

      const patched = await send(app, 'patch', `${path}.json`, ALICE, { notes: 'n' }).expect(200);
      const archived = await send(app, 'post', `${path}/archive.json`, ALICE).expect(200);
      const unarchived = await send(app, 'post', `${path}/unarchive.json`, ALICE).expect(200);
      const detail = await send(app, 'get', `${path}.json`, ALICE).expect(200);

      [created, patched, archived, unarchived].forEach((response) => {
        expect(response.body.account_number).toBe(masked);
      });
      expect(detail.body.account_number).toBe('98765-4');
    });
  });

  describe('update', () => {
    it('edits fields and the opening anchor', async () => {
      const account = await createAccount(app, ALICE, null, { bank_name: 'Old' });

      const response = await send(app, 'patch', `/bank/accounts/${account.id}.json`, ALICE, {
        bank_name: 'New', opening_date: '2025-12-31', opening_balance: '-10.10',
      }).expect(200);

      expect(response.body).toMatchObject({ bank_name: 'New', opening_date: '2025-12-31', opening_balance: '-10.10' });
    });

    it.each([
      ['type', { type: 'debt' }],
      ['accountId', { accountId: 1 }],
      ['userId', { userId: 8 }],
      ['organization_id', { organization_id: 4 }],
      ['a computed balance', { balance: '1.00' }],
    ])('rejects %s with a 400', async (_label, body) => {
      const account = await createAccount(app, ALICE, null);

      await send(app, 'patch', `/bank/accounts/${account.id}.json`, ALICE, body).expect(400);
    });

    it('accepts only a rename on an archived account', async () => {
      const account = await createAccount(app, ALICE, null);
      await send(app, 'post', `/bank/accounts/${account.id}/archive.json`, ALICE).expect(200);

      const renamed = await send(app, 'patch', `/bank/accounts/${account.id}.json`, ALICE, { name: 'Renamed archived' });
      const edited = await send(app, 'patch', `/bank/accounts/${account.id}.json`, ALICE, { notes: 'no' });

      expect(renamed.status).toBe(200);
      expect(edited.status).toBe(409);
      expect(edited.body.error.code).toBe('ACCOUNT_ARCHIVED');
    });

    it('allows a currency change before any transaction and locks it afterwards', async () => {
      const account = await createAccount(app, ALICE, null, { opening_balance: '12.00', opening_date: '2026-01-01' });

      const changed = await send(app, 'patch', `/bank/accounts/${account.id}.json`, ALICE, { currency: 'JPY' }).expect(200);
      expect(changed.body).toMatchObject({ currency: 'JPY', opening_balance: '12' });

      await send(app, 'post', `/bank/accounts/${account.id}/transactions.json`, ALICE, {
        date: '2026-01-02', amount: '5', description: 'x',
      }).expect(201);
      const locked = await send(app, 'patch', `/bank/accounts/${account.id}.json`, ALICE, { currency: 'USD' }).expect(409);

      expect(locked.body.error.code).toBe('CURRENCY_LOCKED');
    });
  });

  describe('archive and delete', () => {
    it('archives and unarchives', async () => {
      const account = await createAccount(app, ALICE, null);

      const archived = await send(app, 'post', `/bank/accounts/${account.id}/archive.json`, ALICE).expect(200);
      const restored = await send(app, 'post', `/bank/accounts/${account.id}/unarchive.json`, ALICE).expect(200);

      expect(archived.body.archived_at).toEqual(expect.any(String));
      expect(restored.body.archived_at).toBeNull();
    });

    it('keeps an archived account and its ledger reachable', async () => {
      const account = await createAccount(app, ALICE, null);
      await send(app, 'post', `/bank/accounts/${account.id}/archive.json`, ALICE).expect(200);

      await send(app, 'get', `/bank/accounts/${account.id}.json`, ALICE).expect(200);
      await send(app, 'get', `/bank/accounts/${account.id}/transactions.json`, ALICE).expect(200);
    });

    it('deletes an account without transactions (opening anchor only)', async () => {
      const account = await createAccount(app, ALICE, ALICE_ORG, { opening_balance: '50.00' });

      const response = await send(app, 'delete', `/orgs/${ALICE_ORG}/bank/accounts/${account.id}.json`, ALICE).expect(204);

      expect(response.body).toEqual({});
      await send(app, 'get', `/orgs/${ALICE_ORG}/bank/accounts/${account.id}.json`, ALICE).expect(404);
    });

    it('answers 409 pointing to archive when the account has transactions', async () => {
      const account = await createAccount(app, ALICE, null, { opening_date: '2026-01-01' });
      await send(app, 'post', `/bank/accounts/${account.id}/transactions.json`, ALICE, {
        date: '2026-01-02', amount: '1.00', description: 'x',
      }).expect(201);

      const response = await send(app, 'delete', `/bank/accounts/${account.id}.json`, ALICE).expect(409);

      expect(response.body.error).toEqual({ code: 'ACCOUNT_HAS_TRANSACTIONS', message: expect.stringMatching(/archive/) });
    });
  });

  describe('caching', () => {
    it('sends X-Skip-Cache and the user-scoped Cache-Control on GETs', async () => {
      const response = await send(app, 'get', '/bank/accounts.json', ALICE).expect(200);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it('marks writes as never', async () => {
      const response = await send(app, 'post', '/bank/accounts.json', ALICE, { name: 'Cache write' }).expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
