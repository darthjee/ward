import type { INestApplication } from '@nestjs/common';
import { Transaction } from '../entities/transaction.entity.js';
import {
  ALICE,
  ALICE_ORG,
  base,
  buildBankTestApp,
  createAccount,
  send,
  withoutTimestamp,
} from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { createOwnerFixtures, NOT_FOUND_CASES, ownerKeysIn, type OwnerFixtures } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

type Method = 'get' | 'post' | 'patch' | 'delete';
type TransactionKey = keyof OwnerFixtures['transactions'];

const TRANSACTION_ROUTES: Array<[string, Method, boolean, object?]> = [
  ['GET ledger', 'get', false],
  ['POST', 'post', false, { date: '2026-01-03', amount: '1.00', description: 'x' }],
  ['PATCH', 'patch', true, { notes: 'x' }],
  ['DELETE', 'delete', true],
];

function transactionPath(prefix: string, accountId: number | string, transactionId?: number | string): string {
  return transactionId === undefined
    ? `${prefix}/accounts/${accountId}/transactions.json`
    : `${prefix}/accounts/${accountId}/transactions/${transactionId}.json`;
}

describe('bank transaction routes (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  async function newAccount(orgId: number | null = null, fields: object = {}): Promise<number> {
    return (await createAccount(app, ALICE, orgId, { opening_date: '2026-01-01', ...fields })).id;
  }

  describe('create, edit and delete', () => {
    it.each([null, ALICE_ORG])('works under the prefix of %p', async (orgId) => {
      const accountId = await newAccount(orgId);
      const prefix = base(orgId);

      const created = await send(app, 'post', transactionPath(prefix, accountId), ALICE, {
        date: '2026-01-10', amount: '-1234.56', description: '  Rent  ', notes: 'January',
      }).expect(201);

      expect(created.body).toEqual({
        id: expect.any(Number),
        date: '2026-01-10',
        amount: '-1234.56',
        description: 'Rent',
        notes: 'January',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(repos.transactions.rows.find((row) => row.id === created.body.id)?.amount).toBe(-123456n);

      const edited = await send(app, 'patch', transactionPath(prefix, accountId, created.body.id), ALICE, {
        amount: '10', notes: null,
      }).expect(200);
      expect(edited.body).toMatchObject({ amount: '10.00', notes: null, description: 'Rent' });

      await send(app, 'delete', transactionPath(prefix, accountId, created.body.id), ALICE).expect(204);
      expect(repos.transactions.rows.some((row) => row.id === created.body.id)).toBe(false);
    });

    it.each([
      ['BRL', '-0.01', '-0.01'],
      ['JPY', '500', '500'],
      ['BHD', '1.234', '1.234'],
      ['BRL', '100000000000.00', '100000000000.00'],
    ])('accepts %s amounts like %p', async (currency, amount, expected) => {
      const accountId = await newAccount(null, { currency });

      const response = await send(app, 'post', transactionPath('/bank', accountId), ALICE, {
        date: '2026-01-02', amount, description: 'ok',
      }).expect(201);

      expect(response.body.amount).toBe(expected);
    });

    it('accepts UTC today + 1 day and a 255-character description', async () => {
      const accountId = await newAccount();

      await send(app, 'post', transactionPath('/bank', accountId), ALICE, {
        date: isoDay(1), amount: '1', description: 'd'.repeat(255),
      }).expect(201);
    });

    it.each([
      ['a zero amount', 'BRL', { amount: '0.00' }],
      ['three decimals in BRL', 'BRL', { amount: '10.555' }],
      ['decimals in JPY', 'JPY', { amount: '1.5' }],
      ['four decimals in BHD', 'BHD', { amount: '1.2345' }],
      ['an amount over 10^13 minor units', 'BRL', { amount: '100000000000.01' }],
      ['a date after UTC today + 1 day', 'BRL', { date: isoDay(2) }],
      ['a missing description', 'BRL', { description: undefined }],
      ['a blank description', 'BRL', { description: '  ' }],
      ['a 256-character description', 'BRL', { description: 'd'.repeat(256) }],
      ['2001-character notes', 'BRL', { notes: 'n'.repeat(2001) }],
      ['an unknown field', 'BRL', { color: 'red' }],
      ['accountId', 'BRL', { accountId: 1 }],
      ['account_id', 'BRL', { account_id: 1 }],
      ['userId', 'BRL', { userId: 1 }],
      ['organizationId', 'BRL', { organizationId: 1 }],
      ['sent_to_accountant_at', 'BRL', { sent_to_accountant_at: '2026-01-01T00:00:00Z' }],
      ['a computed balance', 'BRL', { balance: '1.00' }],
    ])('rejects %s with a 400', async (_label, currency, fields) => {
      const accountId = await newAccount(null, { currency });
      const before = repos.transactions.rows.length;

      await send(app, 'post', transactionPath('/bank', accountId), ALICE, {
        date: '2026-01-02', amount: '1', description: 'ok', ...fields,
      }).expect(400);
      expect(repos.transactions.rows.length).toBe(before);
    });

    it('answers 409 on every write of an archived account', async () => {
      const accountId = await newAccount();
      const created = await send(app, 'post', transactionPath('/bank', accountId), ALICE, {
        date: '2026-01-02', amount: '1', description: 'x',
      }).expect(201);
      await send(app, 'post', `/bank/accounts/${accountId}/archive.json`, ALICE).expect(200);

      const responses = [
        await send(app, 'post', transactionPath('/bank', accountId), ALICE, { date: '2026-01-02', amount: '1', description: 'x' }),
        await send(app, 'patch', transactionPath('/bank', accountId, created.body.id), ALICE, { notes: 'x' }),
        await send(app, 'delete', transactionPath('/bank', accountId, created.body.id), ALICE),
      ];

      responses.forEach((response) => {
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('ACCOUNT_ARCHIVED');
      });
    });
  });

  describe('uniform 404', () => {
    let fixtures: OwnerFixtures;
    let reference: object;

    beforeAll(async () => {
      fixtures = await createOwnerFixtures(app);
      reference = withoutTimestamp(await send(app, 'get', transactionPath('/bank', 999999), ALICE).expect(404));
    });

    const keyOf = (accountId: number | string, f: OwnerFixtures): TransactionKey | undefined =>
      (Object.keys(f.transactions) as TransactionKey[]).find((key) => f[key] === accountId);

    describe.each(TRANSACTION_ROUTES)('%s', (_route, method, needsTransaction, body) => {
      it.each(NOT_FOUND_CASES.map((matrixCase) => [matrixCase.label, matrixCase]))(
        'answers the identical 404 for %s',
        async (_label, { user, admin, orgId, accountId }) => {
          const account = accountId(fixtures);
          const key = keyOf(account, fixtures);
          const transactionId = needsTransaction ? (key ? fixtures.transactions[key] : 1) : undefined;

          const response = await send(app, method, transactionPath(base(orgId), account, transactionId), user, body, admin);

          expect(response.status).toBe(404);
          expect(withoutTimestamp(response)).toEqual(reference);
        },
      );
    });

    it.each([
      ['a transaction of another account of the same owner', (f: OwnerFixtures) => f.transactions.bobPersonal],
      ['an unknown transaction', () => 999999],
      ['a non-numeric transaction id', () => 'abc'],
    ])('answers the identical 404 for %s', async (_label, transactionId) => {
      const path = transactionPath('/bank', fixtures.alicePersonal, transactionId(fixtures));
      const patch = await send(app, 'patch', path, ALICE, { notes: 'x' });
      const remove = await send(app, 'delete', path, ALICE);

      [patch, remove].forEach((response) => {
        expect(response.status).toBe(404);
        expect(withoutTimestamp(response)).toEqual(reference);
      });
    });

    it('never moved or deleted a fixture transaction', () => {
      Object.values(fixtures.transactions).forEach((id) => {
        expect(repos.transactions.rows.find((row) => row.id === id)).toMatchObject({ notes: null });
      });
    });
  });

  describe('ledger envelope', () => {
    let accountId: number;

    beforeAll(async () => {
      accountId = await newAccount(ALICE_ORG, { opening_balance: '1000.00', opening_date: '2026-01-01' });
      for (let index = 1; index <= 120; index++) {
        repos.transactions.rows.push(Object.assign(new Transaction(), {
          id: 100000 + index,
          accountId,
          date: new Date(Date.UTC(2025, 11, 1) + index * DAY_MS).toISOString().slice(0, 10),
          amount: 100n,
          description: `t${index}`,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      }
    });

    const ledger = (query = '') =>
      send(app, 'get', `${transactionPath(`/orgs/${ALICE_ORG}/bank`, accountId)}${query}`, ALICE);

    it('serves 50 rows per page, newest first, with the opening row only on the last page', async () => {
      const first = await ledger().expect(200);
      const second = await ledger('?page=2').expect(200);
      const last = await ledger('?page=3').expect(200);

      expect(first.body.pagination).toEqual({ page: 1, per_page: 50, total_pages: 3, total_count: 120 });
      expect(first.body.transactions).toHaveLength(50);
      expect(second.body.transactions).toHaveLength(50);
      expect(last.body.transactions).toHaveLength(20);
      expect(first.body.opening).toBeNull();
      expect(second.body.opening).toBeNull();
      // 30 transactions dated before the anchor (Dec 2025): opening = 1000.00 - 30 × 1.00.
      expect(last.body.opening).toEqual({ date: '2026-01-01', amount: '970.00', balance: '970.00' });
      expect(first.body.transactions[0]).toEqual({
        id: 100120, date: expect.any(String), amount: '1.00', description: 't120', notes: null, balance: '1090.00',
      });
      expect(second.body.transactions[0].balance).toBe('1040.00');
      expect(last.body.transactions.at(-1)).toMatchObject({ description: 't1', balance: '971.00' });
      expect(ownerKeysIn(first.body)).toEqual([]);
    });

    it('answers an empty page past the last one, with the same metadata', async () => {
      const response = await ledger('?page=9').expect(200);

      expect(response.body).toEqual({
        transactions: [],
        opening: null,
        pagination: { page: 9, per_page: 50, total_pages: 3, total_count: 120 },
      });
    });

    it.each(['0', '-1', 'abc', '1.5'])('rejects page=%s with a 400', async (page) => {
      await ledger(`?page=${page}`).expect(400);
    });

    it('works through the backfilling example of transactions.md', async () => {
      const backfilled = await newAccount(null, { opening_balance: '10000', opening_date: '2026-11-01' });
      await send(app, 'post', transactionPath('/bank', backfilled), ALICE, { date: '2026-10-05', amount: '15000', description: 'in' });
      await send(app, 'post', transactionPath('/bank', backfilled), ALICE, { date: '2026-10-20', amount: '-10000', description: 'out' });

      const response = await send(app, 'get', transactionPath('/bank', backfilled), ALICE).expect(200);
      const detail = await send(app, 'get', `/bank/accounts/${backfilled}.json`, ALICE).expect(200);

      expect(response.body.opening).toEqual({ date: '2026-11-01', amount: '5000.00', balance: '5000.00' });
      expect(response.body.transactions.map((row: { balance: string }) => row.balance)).toEqual(['10000.00', '20000.00']);
      expect(detail.body.balance).toBe('10000.00');
    });

    it('edits the opening anchor through the account PATCH', async () => {
      const anchored = await newAccount();

      await send(app, 'patch', `/bank/accounts/${anchored}.json`, ALICE, { opening_balance: '7.00' }).expect(200);
      const response = await send(app, 'get', transactionPath('/bank', anchored), ALICE).expect(200);

      expect(response.body.opening).toMatchObject({ amount: '7.00' });
    });

    it('is user-scoped (GET) and never (writes) for caching', async () => {
      const get = await ledger().expect(200);
      const post = await send(app, 'post', transactionPath(`/orgs/${ALICE_ORG}/bank`, accountId), ALICE, {
        date: '2026-01-02', amount: '1', description: 'x',
      }).expect(201);

      expect(get.headers['x-skip-cache']).toBe('true');
      expect(get.headers['cache-control']).toBe('private, no-store');
      expect(post.headers['x-skip-cache']).toBe('true');
      expect(post.headers['cache-control']).toBe('no-store');
    });
  });
});
