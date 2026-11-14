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
import { NOT_FOUND_CASES, ownerKeysIn, type OwnerFixtures } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

// Investment accounts (docs/agents/modules/bank/investment.md, docs/agents/backend/routes/bank.md): the
// generic account routes with `type: investment` and a nested `investment` object, in both owner
// contexts.

type Method = 'get' | 'post' | 'patch' | 'delete';
type Body = Record<string, unknown>;

const NULL_INVESTMENT = {
  kind: null,
  yield_rate: null,
  yield_period: null,
  maturity_date: null,
  liquidity_days: null,
};

const FULL_INVESTMENT = {
  kind: 'fixed_income',
  yield_rate: '1.1',
  yield_period: 'monthly',
  maturity_date: '2030-01-15',
  liquidity_days: 30,
};

const KINDS = ['fixed_income', 'fund', 'stocks', 'savings', 'pension', 'crypto', 'other'];

const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];

const INVESTMENT_ROUTES: Array<[string, Method, (prefix: string, id: number | string) => string, object?]> = [
  ['GET detail', 'get', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['PATCH investment', 'patch', (prefix, id) => `${prefix}/accounts/${id}.json`, { investment: { liquidity_days: 5 } }],
  ['DELETE', 'delete', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['POST archive', 'post', (prefix, id) => `${prefix}/accounts/${id}/archive.json`],
  ['POST unarchive', 'post', (prefix, id) => `${prefix}/accounts/${id}/unarchive.json`],
  ['GET transactions', 'get', (prefix, id) => `${prefix}/accounts/${id}/transactions.json`],
  ['POST transaction', 'post', (prefix, id) => `${prefix}/accounts/${id}/transactions.json`, {
    date: '2026-01-02',
    amount: '10.00',
    description: 'Application',
  }],
];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('investment accounts (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const createInvestment = (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { type: 'investment', name: uniqueName('CDB'), ...fields });
  const accountPath = (orgId: number | null, id: number) => `${base(orgId)}/accounts/${id}.json`;
  const patch = (orgId: number | null, id: number, body: Body) => send(app, 'patch', accountPath(orgId, id), ALICE, body);
  const detailsOf = (id: number) => repos.investmentDetails.rows.find((row) => row.accountId === id);
  const addTransaction = (orgId: number | null, id: number, amount: string, description = 'Application') =>
    send(app, 'post', `${base(orgId)}/accounts/${id}/transactions.json`, ALICE, { date: '2026-01-02', amount, description });

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const prefix = base(orgId);

    describe('create', () => {
      it('creates an investment without an investment object, with an all-null details row', async () => {
        const created = await createInvestment(orgId);

        expect(created).toMatchObject({ type: 'investment', opening_balance: '0.00', balance: '0.00', investment: NULL_INVESTMENT });
        expect(detailsOf(created.id)).toMatchObject({
          kind: null,
          yieldRate: null,
          yieldPeriod: null,
          maturityDate: null,
          liquidityDays: null,
        });
      });

      it('creates an investment with a full investment object', async () => {
        const created = await createInvestment(orgId, { investment: FULL_INVESTMENT, bank_name: 'XP', notes: '110% CDI' });

        expect(created.investment).toEqual(FULL_INVESTMENT);
        expect(created).toMatchObject({ bank_name: 'XP', notes: '110% CDI' });
        expect(detailsOf(created.id)).toMatchObject({ kind: 'fixed_income', yieldRate: '1.1', liquidityDays: 30 });
      });

      it('still applies the common-field validation', async () => {
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'investment' }).expect(400);
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'investment', name: 'x', user_id: 1 }).expect(400);
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'investment', name: 'x', currency: 'XYZ' }).expect(400);
      });
    });

    describe('opening balance', () => {
      it.each(['0', '0.00'])('accepts %p on create and PATCH', async (opening) => {
        const created = await createInvestment(orgId, { opening_balance: opening });
        expect(created.opening_balance).toBe('0.00');

        await patch(orgId, created.id, { opening_balance: opening }).expect(200);
      });

      it.each(['0.01', '-100.00', '1000.00'])('rejects %p with a 400 on create and PATCH', async (opening) => {
        const before = repos.accounts.rows.length;
        const createRes = await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'investment',
          name: uniqueName('Bad'),
          opening_balance: opening,
        }).expect(400);
        expect(createRes.body.error.message).toContain('opening_balance must be 0 on investment accounts');
        expect(repos.accounts.rows.length).toBe(before);

        const created = await createInvestment(orgId);
        await patch(orgId, created.id, { opening_balance: opening }).expect(400);

        const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body.opening_balance).toBe('0.00');
      });

      it('keeps the opening balance 0 across a currency change', async () => {
        const created = await createInvestment(orgId);

        const changed = await patch(orgId, created.id, { currency: 'JPY' }).expect(200);

        expect(changed.body).toMatchObject({ currency: 'JPY', opening_balance: '0' });
      });

      it('leaves the opening balance of regular and debt accounts unrestricted', async () => {
        await createAccount(app, ALICE, orgId, { opening_balance: '10.00' });
        await createAccount(app, ALICE, orgId, { type: 'debt', opening_balance: '-10.00' });
      });
    });

    describe('responses', () => {
      it('carries the investment object on list rows, detail, create, PATCH, archive and unarchive', async () => {
        const created = await createInvestment(orgId, { investment: FULL_INVESTMENT });
        const responses = [
          await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200),
          await patch(orgId, created.id, { notes: 'n' }).expect(200),
          await send(app, 'post', `${prefix}/accounts/${created.id}/archive.json`, ALICE).expect(200),
          await send(app, 'post', `${prefix}/accounts/${created.id}/unarchive.json`, ALICE).expect(200),
        ];
        const list = await send(app, 'get', `${prefix}/accounts.json?type=investment`, ALICE).expect(200);

        expect(created.investment).toEqual(FULL_INVESTMENT);
        responses.forEach((response) => expect(response.body.investment).toEqual(FULL_INVESTMENT));
        expect(list.body.find((row: { id: number }) => row.id === created.id).investment).toEqual(FULL_INVESTMENT);
        expect(ownerKeysIn([created, list.body, ...responses.map((response) => response.body)])).toEqual([]);
        expect(created).not.toHaveProperty('debt');
      });

      it('returns yield_rate without trailing zeros', async () => {
        const created = await createInvestment(orgId, { investment: { yield_rate: '12.5000', yield_period: 'yearly' } });

        const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);

        expect(detail.body.investment.yield_rate).toBe('12.5');
      });

      it('never carries an investment object on regular and debt accounts', async () => {
        const regular = await createAccount(app, ALICE, orgId);
        const debt = await createAccount(app, ALICE, orgId, { type: 'debt' });
        const details = [
          await send(app, 'get', accountPath(orgId, regular.id), ALICE).expect(200),
          await send(app, 'get', accountPath(orgId, debt.id), ALICE).expect(200),
        ];
        const lists = [
          await send(app, 'get', `${prefix}/accounts.json`, ALICE).expect(200),
          await send(app, 'get', `${prefix}/accounts.json?type=debt`, ALICE).expect(200),
        ];

        [regular, debt, ...details.map((response) => response.body)].forEach((body) =>
          expect(body).not.toHaveProperty('investment'));
        lists.forEach((list) => list.body.forEach((row: object) => expect(row).not.toHaveProperty('investment')));
      });
    });

    describe('validation', () => {
      it.each([
        ['yield_rate without yield_period', { yield_rate: '1.5' }],
        ['yield_period without yield_rate', { yield_period: 'monthly' }],
        ['a negative liquidity_days', { liquidity_days: -1 }],
        ['a fractional liquidity_days', { liquidity_days: 1.5 }],
        ['a string liquidity_days', { liquidity_days: '3' }],
        ['liquidity_days over the int column bound', { liquidity_days: 2147483648 }],
        ['an unknown kind', { kind: 'bonds' }],
        ['a negative yield_rate', { yield_rate: '-1', yield_period: 'monthly' }],
        ['a yield_rate over 100', { yield_rate: '100.01', yield_period: 'monthly' }],
        ['a yield_rate with 5 decimals', { yield_rate: '1.00001', yield_period: 'monthly' }],
        ['a numeric yield_rate', { yield_rate: 1.5, yield_period: 'monthly' }],
        ['an unknown yield_period', { yield_rate: '1', yield_period: 'daily' }],
        ['an impossible maturity_date', { maturity_date: '2026-02-30' }],
        ['a malformed maturity_date', { maturity_date: '2030/01/15' }],
        ['an unknown field inside investment', { color: 'red' }],
      ])('rejects %s with a 400 on create and PATCH', async (_label, investment) => {
        const before = repos.accounts.rows.length;
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'investment',
          name: uniqueName('Bad'),
          investment,
        }).expect(400);
        expect(repos.accounts.rows.length).toBe(before);

        const created = await createInvestment(orgId);
        await patch(orgId, created.id, { investment }).expect(400);
        expect(detailsOf(created.id)).toMatchObject({ kind: null, yieldRate: null, liquidityDays: null });
      });

      it('answers format errors with VALIDATION_FAILED', async () => {
        const response = await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'investment',
          name: uniqueName('Bad'),
          investment: { liquidity_days: -1 },
        }).expect(400);

        expect(response.body.error.code).toBe('VALIDATION_FAILED');
      });

      it('rejects a null investment object', async () => {
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'investment', name: uniqueName('Bad'), investment: null })
          .expect(400);
      });

      it('rejects an investment object on regular and debt accounts, on create and PATCH', async () => {
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { name: uniqueName('Reg'), investment: {} }).expect(400);
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'debt',
          name: uniqueName('Debt'),
          investment: { kind: 'fund' },
        }).expect(400);

        const regular = await createAccount(app, ALICE, orgId);
        await patch(orgId, regular.id, { investment: { kind: 'fund' } }).expect(400);
        const debt = await createAccount(app, ALICE, orgId, { type: 'debt' });
        await patch(orgId, debt.id, { investment: { kind: 'fund' } }).expect(400);
      });

      it('rejects a debt object on an investment account, on create and PATCH', async () => {
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'investment',
          name: uniqueName('Inv'),
          debt: { due_day: 1 },
        }).expect(400);

        const created = await createInvestment(orgId);
        await patch(orgId, created.id, { debt: { due_day: 1 } }).expect(400);
      });

      it.each([
        ...KINDS.map((kind): [string, Body, Body] => [`kind ${kind}`, { kind }, { kind }]),
        ['yield_rate 0', { yield_rate: '0', yield_period: 'monthly' }, { yield_rate: '0' }],
        ['yield_rate 100', { yield_rate: '100', yield_period: 'yearly' }, { yield_rate: '100' }],
        ['yield_rate with 4 decimals', { yield_rate: '12.3456', yield_period: 'yearly' }, { yield_rate: '12.3456' }],
        ['liquidity_days 0', { liquidity_days: 0 }, { liquidity_days: 0 }],
        ['liquidity_days at the int column bound', { liquidity_days: 2147483647 }, { liquidity_days: 2147483647 }],
        ['a past maturity_date', { maturity_date: '2001-01-01' }, { maturity_date: '2001-01-01' }],
        ['a far-future maturity_date', { maturity_date: '2099-12-31' }, { maturity_date: '2099-12-31' }],
      ])('accepts %s', async (_label, investment, expected) => {
        const created = await createInvestment(orgId, { investment });

        expect(created.investment).toMatchObject(expected);
      });
    });

    describe('PATCH', () => {
      it('merges the investment object partially and clears fields sent as null', async () => {
        const created = await createInvestment(orgId, { investment: FULL_INVESTMENT });

        const merged = await patch(orgId, created.id, { investment: { liquidity_days: 2 } }).expect(200);
        expect(merged.body.investment).toEqual({ ...FULL_INVESTMENT, liquidity_days: 2 });

        const cleared = await patch(orgId, created.id, { investment: { kind: null, maturity_date: null } }).expect(200);
        expect(cleared.body.investment).toEqual({ ...FULL_INVESTMENT, liquidity_days: 2, kind: null, maturity_date: null });
      });

      it('checks the paired rule on the merged state', async () => {
        const created = await createInvestment(orgId, { investment: FULL_INVESTMENT });

        const rate = await patch(orgId, created.id, { investment: { yield_rate: '3' } }).expect(200);
        expect(rate.body.investment).toMatchObject({ yield_rate: '3', yield_period: 'monthly' });
        await patch(orgId, created.id, { investment: { yield_period: null } }).expect(400);
        await patch(orgId, created.id, { investment: { yield_rate: null } }).expect(400);

        const cleared = await patch(orgId, created.id, { investment: { yield_rate: null, yield_period: null } }).expect(200);
        expect(cleared.body.investment).toMatchObject({ yield_rate: null, yield_period: null });

        await patch(orgId, created.id, { investment: { yield_rate: '3' } }).expect(400);
      });

      it('rejects a type change', async () => {
        const created = await createInvestment(orgId);

        await patch(orgId, created.id, { type: 'regular' }).expect(400);
        await patch(orgId, created.id, { type: 'investment' }).expect(400);
      });
    });

    describe('ledger', () => {
      it('allows a negative balance, with no error', async () => {
        const created = await createInvestment(orgId, { opening_date: '2026-01-01' });
        await addTransaction(orgId, created.id, '100.00').expect(201);
        await addTransaction(orgId, created.id, '-150.00', 'Withdrawal').expect(201);

        const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body).toMatchObject({ opening_balance: '0.00', balance: '-50.00' });
      });
    });

    describe('archived investment', () => {
      it('accepts only a rename; any investment field answers 409, even one breaking the paired rule', async () => {
        const created = await createInvestment(orgId, { opening_date: '2026-01-01', investment: FULL_INVESTMENT });
        await send(app, 'post', `${prefix}/accounts/${created.id}/archive.json`, ALICE).expect(200);

        const renamed = await patch(orgId, created.id, { name: uniqueName('Old CDB') }).expect(200);
        expect(renamed.body.investment).toEqual(FULL_INVESTMENT);

        for (const body of [
          { investment: { liquidity_days: 5 } },
          { investment: { yield_period: null } },
          { investment: {} },
          { opening_balance: '5.00' },
          { opening_balance: '0' },
        ]) {
          const response = await patch(orgId, created.id, body).expect(409);
          expect(response.body.error.code).toBe('ACCOUNT_ARCHIVED');
        }

        // A malformed body is rejected by the validation pipe before reaching the service.
        await patch(orgId, created.id, { investment: { liquidity_days: -1 } }).expect(400);

        const write = await addTransaction(orgId, created.id, '10.00').expect(409);
        expect(write.body.error.code).toBe('ACCOUNT_ARCHIVED');
        expect(detailsOf(created.id)?.liquidityDays).toBe(30);
      });
    });

    describe('delete', () => {
      it('deletes an investment without transactions together with its details row', async () => {
        const created = await createInvestment(orgId, { investment: FULL_INVESTMENT });

        await send(app, 'delete', accountPath(orgId, created.id), ALICE).expect(204);

        expect(detailsOf(created.id)).toBeUndefined();
        await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(404);
      });

      it('answers 409 for an investment with transactions and keeps its details', async () => {
        const created = await createInvestment(orgId, { opening_date: '2026-01-01' });
        await addTransaction(orgId, created.id, '10.00').expect(201);

        const response = await send(app, 'delete', accountPath(orgId, created.id), ALICE).expect(409);

        expect(response.body.error.code).toBe('ACCOUNT_HAS_TRANSACTIONS');
        expect(detailsOf(created.id)).toBeDefined();
      });
    });

    describe('name uniqueness across types', () => {
      it.each([
        ['regular', {}],
        ['debt', { type: 'debt' }],
      ])('clashes with an active %s account (case-insensitive) on create, rename and unarchive', async (_type, other) => {
        const name = uniqueName('XP');
        await createAccount(app, ALICE, orgId, { name, ...other });

        const create = await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'investment', name: name.toUpperCase() });
        expect(create.status).toBe(409);
        expect(create.body.error.code).toBe('ACCOUNT_NAME_TAKEN');

        const investment = await createInvestment(orgId);
        const rename = await patch(orgId, investment.id, { name: name.toLowerCase() }).expect(409);
        expect(rename.body.error.code).toBe('ACCOUNT_NAME_TAKEN');

        const archivedName = uniqueName('Itaú');
        const archived = await createInvestment(orgId, { name: archivedName });
        await send(app, 'post', `${prefix}/accounts/${archived.id}/archive.json`, ALICE).expect(200);
        await createAccount(app, ALICE, orgId, { name: archivedName.toUpperCase(), ...other });
        const unarchive = await send(app, 'post', `${prefix}/accounts/${archived.id}/unarchive.json`, ALICE).expect(409);
        expect(unarchive.body.error.code).toBe('ACCOUNT_NAME_TAKEN');
      });
    });

    describe('list', () => {
      it('lists only investments, sorted by name, hiding archived ones unless asked', async () => {
        const tag = uniqueName('List');
        const zed = await createInvestment(orgId, { name: `${tag} zed` });
        const alpha = await createInvestment(orgId, { name: `${tag} Alpha` });
        const archived = await createInvestment(orgId, { name: `${tag} middle` });
        const regular = await createAccount(app, ALICE, orgId, { name: `${tag} regular` });
        const debt = await createAccount(app, ALICE, orgId, { type: 'debt', name: `${tag} debt` });
        await send(app, 'post', `${prefix}/accounts/${archived.id}/archive.json`, ALICE).expect(200);

        const ids = async (query: string): Promise<number[]> => {
          const response = await send(app, 'get', `${prefix}/accounts.json${query}`, ALICE).expect(200);
          return response.body
            .filter((row: { name: string }) => row.name.startsWith(tag))
            .map((row: { id: number }) => row.id);
        };

        expect(await ids('?type=investment')).toEqual([alpha.id, zed.id]);
        expect(await ids('?type=investment&archived=true')).toEqual([alpha.id, archived.id, zed.id]);
        expect(await ids('')).toEqual([regular.id]);
        expect(await ids('?type=debt')).toEqual([debt.id]);
      });

      it('loads balances and details with one batch each (no N+1)', async () => {
        await createInvestment(orgId);
        await createInvestment(orgId);
        const balancesBefore = AccountBalancesQuery.groupedCalls;
        const detailsBefore = repos.investmentDetails.findCalls;

        const response = await send(app, 'get', `${prefix}/accounts.json?type=investment&archived=true`, ALICE).expect(200);

        expect(response.body.length).toBeGreaterThan(2);
        expect(AccountBalancesQuery.groupedCalls - balancesBefore).toBe(1);
        expect(repos.investmentDetails.findCalls - detailsBefore).toBe(1);
      });
    });
  });

  describe('uniform 404', () => {
    let fixtures: OwnerFixtures;
    let reference: object;

    beforeAll(async () => {
      fixtures = {
        alicePersonal: (await createInvestment(null)).id,
        aliceOrg: (await createInvestment(ALICE_ORG)).id,
        bobPersonal: (await createInvestment(null, {}, BOB)).id,
        bobOrg: (await createInvestment(BOB_ORG, {}, BOB)).id,
      } as OwnerFixtures;
      reference = withoutTimestamp(await send(app, 'get', '/bank/accounts/999999.json', ALICE).expect(404));
    });

    it('has the standard not-found body', () => {
      expect(reference).toEqual({ error: NOT_FOUND_BODY.error, statusCode: 404 });
    });

    describe.each(INVESTMENT_ROUTES)('%s', (_route, method, path, body) => {
      it.each(NOT_FOUND_CASES.map((matrixCase) => [matrixCase.label, matrixCase]))(
        'answers the identical 404 for %s',
        async (_label, { user, admin, orgId, accountId }) => {
          const response = await send(app, method, path(base(orgId), accountId(fixtures)), user, body, admin);

          expect(response.status).toBe(404);
          expect(withoutTimestamp(response)).toEqual(reference);
        },
      );
    });

    it('answers the identical 404 on the investment list and create for a non-member :orgId', async () => {
      const list = await send(app, 'get', `/orgs/${BOB_ORG}/bank/accounts.json?type=investment`, ALICE).expect(404);
      const create = await send(app, 'post', `/orgs/${BOB_ORG}/bank/accounts.json`, ALICE, { type: 'investment', name: 'x' })
        .expect(404);

      [list, create].forEach((response) => expect(withoutTimestamp(response)).toEqual(reference));
    });

    it('changed nothing', () => {
      [fixtures.alicePersonal, fixtures.aliceOrg, fixtures.bobPersonal, fixtures.bobOrg].forEach((id) => {
        expect(repos.accounts.rows.find((row) => row.id === id)?.archivedAt).toBeNull();
        expect(detailsOf(id)?.liquidityDays).toBeNull();
        expect(repos.transactions.rows.some((row) => row.accountId === id)).toBe(false);
      });
    });
  });

  describe('caching', () => {
    it('sends X-Cache-Allow and the user-scoped Cache-Control on GETs', async () => {
      const created = await createInvestment(null);

      for (const path of ['/bank/accounts.json?type=investment', `/bank/accounts/${created.id}.json`]) {
        const response = await send(app, 'get', path, ALICE).expect(200);
        expect(response.headers['x-cache-allow']).toBe('true');
        expect(response.headers['x-skip-cache']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store');
      }
    });

    it('marks writes as never', async () => {
      const created = await send(app, 'post', '/bank/accounts.json', ALICE, { type: 'investment', name: uniqueName('Cache') })
        .expect(201);
      const patched = await patch(null, created.body.id, { investment: { liquidity_days: 3 } }).expect(200);

      [created, patched].forEach((response) => {
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });
  });
});

describe('investment accounts request / response logging (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await buildBankTestApp({ WARD_LOG_LEVEL: 'debug' }));
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('never logs request or response bodies', async () => {
    const methods = ['debug', 'info', 'log', 'warn', 'error'] as const;
    const spies = methods.map((method) => jest.spyOn(console, method).mockImplementation(() => undefined));

    try {
      const created = await createAccount(app, ALICE, null, {
        type: 'investment',
        name: 'Secret broker CDB',
        bank_name: 'Secret broker',
        notes: 'secret-note-marker',
        investment: { yield_rate: '7.6543', yield_period: 'yearly', maturity_date: '2031-07-19' },
      });
      await send(app, 'patch', `/bank/accounts/${created.id}.json`, ALICE, { investment: { liquidity_days: 77777 } }).expect(200);
      await send(app, 'get', `/bank/accounts/${created.id}.json`, ALICE).expect(200);
      await send(app, 'patch', `/bank/accounts/${created.id}.json`, ALICE, { opening_balance: '4321.98' }).expect(400);
      await send(app, 'patch', `/bank/accounts/${created.id}.json`, ALICE, { investment: { liquidity_days: -1 } }).expect(400);

      const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
      ['Secret broker', 'secret-note-marker', '7.6543', '2031-07-19', '77777', '4321.98'].forEach((marker) => {
        expect(logged).not.toContain(marker);
      });
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
