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

// Debt accounts (docs/agents/specs/banking/accounts/debt.md, *Required tests*): the generic
// account routes with `type: debt` and a nested `debt` object, in both owner contexts.

type Method = 'get' | 'post' | 'patch' | 'delete';
type Body = Record<string, unknown>;

const DEFAULT_DEBT = {
  interest_rate: null,
  interest_period: null,
  instalment_amount: null,
  instalment_frequency: 'monthly',
  due_day: null,
  due_month: null,
  instalment_count: null,
  bills_from: null,
  show_in_calendar: true,
  paying_account: null,
};

const FULL_DEBT = {
  interest_rate: '1.99',
  interest_period: 'monthly',
  instalment_amount: '500.00',
  instalment_frequency: 'yearly',
  due_day: 10,
  due_month: 3,
  instalment_count: 48,
  bills_from: '2026-01-01',
  show_in_calendar: true,
};

const FULL_DEBT_RESPONSE = { ...FULL_DEBT, paying_account: null };

const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];

const DEBT_ROUTES: Array<[string, Method, (prefix: string, id: number | string) => string, object?]> = [
  ['GET detail', 'get', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['PATCH debt', 'patch', (prefix, id) => `${prefix}/accounts/${id}.json`, { debt: { due_day: 5 } }],
  ['DELETE', 'delete', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['POST archive', 'post', (prefix, id) => `${prefix}/accounts/${id}/archive.json`],
  ['POST unarchive', 'post', (prefix, id) => `${prefix}/accounts/${id}/unarchive.json`],
  ['GET transactions', 'get', (prefix, id) => `${prefix}/accounts/${id}/transactions.json`],
];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('debt accounts (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const createDebt = (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { type: 'debt', name: uniqueName('Loan'), ...fields });
  const accountPath = (orgId: number | null, id: number) => `${base(orgId)}/accounts/${id}.json`;
  const patch = (orgId: number | null, id: number, body: Body) => send(app, 'patch', accountPath(orgId, id), ALICE, body);
  const detailsOf = (id: number) => repos.debtDetails.rows.find((row) => row.accountId === id);

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const prefix = base(orgId);

    describe('create', () => {
      it('creates a debt without a debt object, with a default details row', async () => {
        const created = await createDebt(orgId);

        expect(created).toMatchObject({ type: 'debt', debt: DEFAULT_DEBT });
        expect(detailsOf(created.id)).toMatchObject({
          interestRate: null,
          interestPeriod: null,
          instalmentAmount: null,
          instalmentFrequency: 'monthly',
          dueDay: null,
          dueMonth: null,
          instalmentCount: null,
        });
      });

      it('creates a debt with a full debt object', async () => {
        const created = await createDebt(orgId, { debt: FULL_DEBT, opening_balance: '-10000.00' });

        expect(created.debt).toEqual(FULL_DEBT_RESPONSE);
        expect(created.opening_balance).toBe('-10000.00');
        expect(detailsOf(created.id)?.instalmentAmount).toBe(50000n);
      });

      it('formats the instalment amount in the account currency exponent', async () => {
        const created = await createDebt(orgId, { currency: 'JPY', debt: { instalment_amount: '500' } });

        expect(created.debt).toMatchObject({ instalment_amount: '500' });
      });

      it.each(['-10000.00', '0', '250.00'])('accepts the opening balance %p', async (opening) => {
        const created = await createDebt(orgId, { opening_balance: opening });

        expect(created.opening_balance).toBe(opening === '0' ? '0.00' : opening);
      });

      it('still applies the common-field validation', async () => {
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'debt' }).expect(400);
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'debt', name: 'x', user_id: 1 }).expect(400);
      });
    });

    describe('responses', () => {
      it('carries the debt object on list rows, detail, PATCH, archive and unarchive', async () => {
        const created = await createDebt(orgId, { debt: FULL_DEBT });
        const responses = [
          await send(app, 'get', `${prefix}/accounts/${created.id}.json`, ALICE).expect(200),
          await patch(orgId, created.id, { notes: 'n' }).expect(200),
          await send(app, 'post', `${prefix}/accounts/${created.id}/archive.json`, ALICE).expect(200),
          await send(app, 'post', `${prefix}/accounts/${created.id}/unarchive.json`, ALICE).expect(200),
        ];
        const list = await send(app, 'get', `${prefix}/accounts.json?type=debt`, ALICE).expect(200);

        responses.forEach((response) => expect(response.body.debt).toEqual(FULL_DEBT_RESPONSE));
        expect(list.body.find((row: { id: number }) => row.id === created.id).debt).toEqual(FULL_DEBT_RESPONSE);
        expect(ownerKeysIn([created, list.body, ...responses.map((response) => response.body)])).toEqual([]);
      });

      it('never carries a debt object on regular accounts', async () => {
        const regular = await createAccount(app, ALICE, orgId);
        const detail = await send(app, 'get', `${prefix}/accounts/${regular.id}.json`, ALICE).expect(200);
        const list = await send(app, 'get', `${prefix}/accounts.json`, ALICE).expect(200);

        expect(regular).not.toHaveProperty('debt');
        expect(detail.body).not.toHaveProperty('debt');
        list.body.forEach((row: object) => expect(row).not.toHaveProperty('debt'));
      });
    });

    describe('validation', () => {
      it.each([
        ['interest_rate without interest_period', { interest_rate: '1.5' }],
        ['interest_period without interest_rate', { interest_period: 'monthly' }],
        ['yearly without due_month', { instalment_frequency: 'yearly' }],
        ['due_month with monthly', { due_month: 3 }],
        ['due_day 0', { due_day: 0 }],
        ['due_day 32', { due_day: 32 }],
        ['due_month 0', { instalment_frequency: 'yearly', due_month: 0 }],
        ['due_month 13', { instalment_frequency: 'yearly', due_month: 13 }],
        ['instalment_count 0', { instalment_count: 0 }],
        ['instalment_count over the int column bound', { instalment_count: 2147483648 }],
        ['instalment_amount 0', { instalment_amount: '0' }],
        ['a negative instalment_amount', { instalment_amount: '-5.00' }],
        ['an instalment_amount over the bound', { instalment_amount: '100000000000.01' }],
        ['an instalment_amount with too many decimals', { instalment_amount: '5.001' }],
        ['a negative interest_rate', { interest_rate: '-1', interest_period: 'monthly' }],
        ['an interest_rate over 100', { interest_rate: '100.01', interest_period: 'monthly' }],
        ['an interest_rate with 5 decimals', { interest_rate: '1.00001', interest_period: 'monthly' }],
        ['an unknown field inside debt', { color: 'red' }],
        ['a null instalment_frequency', { instalment_frequency: null }],
      ])('rejects %s with a 400 on create and PATCH', async (_label, debt) => {
        const before = repos.accounts.rows.length;
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'debt', name: uniqueName('Bad'), debt }).expect(400);
        expect(repos.accounts.rows.length).toBe(before);

        const created = await createDebt(orgId);
        await patch(orgId, created.id, { debt }).expect(400);
        expect(detailsOf(created.id)).toMatchObject({ dueDay: null, instalmentAmount: null, interestRate: null });
      });

      it('answers an instalment_count over the int column bound with VALIDATION_FAILED, on create and PATCH', async () => {
        const debt = { instalment_count: 2147483648 };
        const createRes = await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'debt', name: uniqueName('Big'), debt })
          .expect(400);
        expect(createRes.body.error.code).toBe('VALIDATION_FAILED');

        const created = await createDebt(orgId);
        const patchRes = await patch(orgId, created.id, { debt }).expect(400);
        expect(patchRes.body.error.code).toBe('VALIDATION_FAILED');
      });

      it('rejects a debt object on a regular account, on create and PATCH', async () => {
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, { name: uniqueName('Reg'), debt: {} }).expect(400);
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'regular',
          name: uniqueName('Reg'),
          debt: { due_day: 1 },
        }).expect(400);

        const regular = await createAccount(app, ALICE, orgId);
        await patch(orgId, regular.id, { debt: { due_day: 1 } }).expect(400);
      });

      it.each([
        ['due_day 1 and instalment_count 1', { due_day: 1, instalment_count: 1 }, { due_day: 1, instalment_count: 1 }],
        ['due_day 31', { due_day: 31 }, { due_day: 31 }],
        ['due_month 1', { instalment_frequency: 'yearly', due_month: 1 }, { due_month: 1 }],
        ['due_month 12', { instalment_frequency: 'yearly', due_month: 12 }, { due_month: 12 }],
        ['interest_rate 0', { interest_rate: '0', interest_period: 'monthly' }, { interest_rate: '0' }],
        ['interest_rate 100', { interest_rate: '100', interest_period: 'yearly' }, { interest_rate: '100' }],
        ['interest_rate with 4 decimals', { interest_rate: '12.3456', interest_period: 'yearly' }, { interest_rate: '12.3456' }],
        ['the amount bound', { instalment_amount: '100000000000.00' }, { instalment_amount: '100000000000.00' }],
        ['instalment_count at the int column bound', { instalment_count: 2147483647 }, { instalment_count: 2147483647 }],
      ])('accepts %s', async (_label, debt, expected) => {
        const created = await createDebt(orgId, { debt });

        expect(created.debt).toMatchObject(expected);
      });
    });

    describe('PATCH', () => {
      it('merges the debt object partially and clears fields sent as null', async () => {
        const created = await createDebt(orgId, { debt: FULL_DEBT });

        const merged = await patch(orgId, created.id, { debt: { due_day: 20 } }).expect(200);
        expect(merged.body.debt).toEqual({ ...FULL_DEBT_RESPONSE, due_day: 20 });

        const cleared = await patch(orgId, created.id, { debt: { instalment_amount: null, instalment_count: null } }).expect(200);
        expect(cleared.body.debt).toEqual({ ...FULL_DEBT_RESPONSE, due_day: 20, instalment_amount: null, instalment_count: null });
      });

      it('checks the paired rules on the merged state', async () => {
        const created = await createDebt(orgId, { debt: FULL_DEBT });

        await patch(orgId, created.id, { debt: { interest_rate: '2.5' } }).expect(200);
        await patch(orgId, created.id, { debt: { interest_period: null } }).expect(400);
        await patch(orgId, created.id, { debt: { interest_rate: null } }).expect(400);

        const cleared = await patch(orgId, created.id, { debt: { interest_rate: null, interest_period: null } }).expect(200);
        expect(cleared.body.debt).toMatchObject({ interest_rate: null, interest_period: null });
      });

      it('clears due_month when switching yearly to monthly, and requires it back for yearly', async () => {
        const created = await createDebt(orgId, { debt: FULL_DEBT });

        const monthly = await patch(orgId, created.id, { debt: { instalment_frequency: 'monthly' } }).expect(200);
        expect(monthly.body.debt).toMatchObject({ instalment_frequency: 'monthly', due_month: null });

        await patch(orgId, created.id, { debt: { due_month: 4 } }).expect(400);
        await patch(orgId, created.id, { debt: { instalment_frequency: 'yearly' } }).expect(400);

        const yearly = await patch(orgId, created.id, { debt: { instalment_frequency: 'yearly', due_month: 7 } }).expect(200);
        expect(yearly.body.debt).toMatchObject({ instalment_frequency: 'yearly', due_month: 7 });
      });

      it('rejects a type change', async () => {
        const created = await createDebt(orgId);

        await patch(orgId, created.id, { type: 'regular' }).expect(400);
        await patch(orgId, created.id, { type: 'debt' }).expect(400);
      });

      it('rescales the instalment amount on a currency change before any transaction', async () => {
        const created = await createDebt(orgId, { debt: { instalment_amount: '500.00' } });

        const changed = await patch(orgId, created.id, { currency: 'JPY' }).expect(200);

        expect(changed.body).toMatchObject({ currency: 'JPY', debt: { instalment_amount: '500' } });
        expect(detailsOf(created.id)?.instalmentAmount).toBe(500n);
      });

      it('rejects a currency that cannot represent the instalment amount (12.50 BRL to JPY)', async () => {
        const created = await createDebt(orgId, { debt: { instalment_amount: '12.50' } });

        await patch(orgId, created.id, { currency: 'JPY' }).expect(400);

        const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body).toMatchObject({ currency: 'BRL', debt: { instalment_amount: '12.50' } });
      });

      it('locks the currency once the debt has transactions', async () => {
        const created = await createDebt(orgId, { opening_date: '2026-01-01', debt: { instalment_amount: '500.00' } });
        await send(app, 'post', `${prefix}/accounts/${created.id}/transactions.json`, ALICE, {
          date: '2026-01-02',
          amount: '500.00',
          description: 'Payment',
        }).expect(201);

        const locked = await patch(orgId, created.id, { currency: 'JPY' }).expect(409);
        expect(locked.body.error.code).toBe('CURRENCY_LOCKED');
      });
    });

    describe('ledger', () => {
      it('allows an overpayment (the balance going positive)', async () => {
        const created = await createDebt(orgId, { opening_date: '2026-01-01', opening_balance: '-100.00' });
        await send(app, 'post', `${prefix}/accounts/${created.id}/transactions.json`, ALICE, {
          date: '2026-01-02',
          amount: '150.00',
          description: 'Payment',
        }).expect(201);

        const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body.balance).toBe('50.00');
      });
    });

    describe('archived debt', () => {
      it('accepts only a rename; any debt field answers 409, even an invalid one', async () => {
        const created = await createDebt(orgId, { opening_date: '2026-01-01', debt: FULL_DEBT });
        await send(app, 'post', `${prefix}/accounts/${created.id}/archive.json`, ALICE).expect(200);

        const renamed = await patch(orgId, created.id, { name: uniqueName('Old loan') }).expect(200);
        expect(renamed.body.debt).toEqual(FULL_DEBT_RESPONSE);

        // `interest_period: null` alone breaks the merged rate/period rule: still 409, not 400.
        for (const debt of [{ due_day: 5 }, { interest_period: null }, { instalment_frequency: 'yearly' }]) {
          const response = await patch(orgId, created.id, { debt }).expect(409);
          expect(response.body.error.code).toBe('ACCOUNT_ARCHIVED');
        }

        // A malformed body is rejected by the validation pipe before reaching the service.
        await patch(orgId, created.id, { debt: { due_day: 99 } }).expect(400);

        const write = await send(app, 'post', `${prefix}/accounts/${created.id}/transactions.json`, ALICE, {
          date: '2026-01-02',
          amount: '10.00',
          description: 'Payment',
        }).expect(409);
        expect(write.body.error.code).toBe('ACCOUNT_ARCHIVED');
        expect(detailsOf(created.id)?.dueDay).toBe(10);
      });
    });

    describe('delete', () => {
      it('deletes a debt without transactions together with its details row', async () => {
        const created = await createDebt(orgId, { debt: FULL_DEBT });

        await send(app, 'delete', accountPath(orgId, created.id), ALICE).expect(204);

        expect(detailsOf(created.id)).toBeUndefined();
        await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(404);
      });

      it('answers 409 for a debt with transactions and keeps its details', async () => {
        const created = await createDebt(orgId, { opening_date: '2026-01-01' });
        await send(app, 'post', `${prefix}/accounts/${created.id}/transactions.json`, ALICE, {
          date: '2026-01-02',
          amount: '10.00',
          description: 'Payment',
        }).expect(201);

        const response = await send(app, 'delete', accountPath(orgId, created.id), ALICE).expect(409);

        expect(response.body.error.code).toBe('ACCOUNT_HAS_TRANSACTIONS');
        expect(detailsOf(created.id)).toBeDefined();
      });
    });

    describe('name uniqueness across types', () => {
      it('clashes with an active regular account (case-insensitive) on create, rename and unarchive', async () => {
        const name = uniqueName('Nubank');
        await createAccount(app, ALICE, orgId, { name });

        const create = await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'debt', name: name.toUpperCase() });
        expect(create.status).toBe(409);
        expect(create.body.error.code).toBe('ACCOUNT_NAME_TAKEN');

        const debt = await createDebt(orgId);
        const rename = await patch(orgId, debt.id, { name: name.toLowerCase() }).expect(409);
        expect(rename.body.error.code).toBe('ACCOUNT_NAME_TAKEN');

        const archivedName = uniqueName('Itaú');
        const archived = await createDebt(orgId, { name: archivedName });
        await send(app, 'post', `${prefix}/accounts/${archived.id}/archive.json`, ALICE).expect(200);
        await createAccount(app, ALICE, orgId, { name: archivedName.toUpperCase() });
        const unarchive = await send(app, 'post', `${prefix}/accounts/${archived.id}/unarchive.json`, ALICE).expect(409);
        expect(unarchive.body.error.code).toBe('ACCOUNT_NAME_TAKEN');
      });
    });

    describe('list', () => {
      it('lists only debts, sorted by name, hiding archived ones unless asked', async () => {
        const tag = uniqueName('List');
        const zed = await createDebt(orgId, { name: `${tag} zed` });
        const alpha = await createDebt(orgId, { name: `${tag} Alpha` });
        const archived = await createDebt(orgId, { name: `${tag} middle` });
        const regular = await createAccount(app, ALICE, orgId, { name: `${tag} regular` });
        await send(app, 'post', `${prefix}/accounts/${archived.id}/archive.json`, ALICE).expect(200);

        const ids = async (query: string): Promise<number[]> => {
          const response = await send(app, 'get', `${prefix}/accounts.json${query}`, ALICE).expect(200);
          return response.body
            .filter((row: { name: string }) => row.name.startsWith(tag))
            .map((row: { id: number; type: string }) => row.id);
        };

        expect(await ids('?type=debt')).toEqual([alpha.id, zed.id]);
        expect(await ids('?type=debt&archived=true')).toEqual([alpha.id, archived.id, zed.id]);
        expect(await ids('')).toEqual([regular.id]);
      });

      it('loads balances and details with one batch each (no N+1)', async () => {
        await createDebt(orgId);
        await createDebt(orgId);
        const balancesBefore = AccountBalancesQuery.groupedCalls;
        const detailsBefore = repos.debtDetails.findCalls;

        const response = await send(app, 'get', `${prefix}/accounts.json?type=debt&archived=true`, ALICE).expect(200);

        expect(response.body.length).toBeGreaterThan(2);
        expect(AccountBalancesQuery.groupedCalls - balancesBefore).toBe(1);
        expect(repos.debtDetails.findCalls - detailsBefore).toBe(1);
      });
    });
  });

  describe('uniform 404', () => {
    let fixtures: OwnerFixtures;
    let reference: object;

    beforeAll(async () => {
      fixtures = {
        alicePersonal: (await createDebt(null)).id,
        aliceOrg: (await createDebt(ALICE_ORG)).id,
        bobPersonal: (await createDebt(null, {}, BOB)).id,
        bobOrg: (await createDebt(BOB_ORG, {}, BOB)).id,
      } as OwnerFixtures;
      reference = withoutTimestamp(await send(app, 'get', '/bank/accounts/999999.json', ALICE).expect(404));
    });

    it('has the standard not-found body', () => {
      expect(reference).toEqual({ error: NOT_FOUND_BODY.error, statusCode: 404 });
    });

    describe.each(DEBT_ROUTES)('%s', (_route, method, path, body) => {
      it.each(NOT_FOUND_CASES.map((matrixCase) => [matrixCase.label, matrixCase]))(
        'answers the identical 404 for %s',
        async (_label, { user, admin, orgId, accountId }) => {
          const response = await send(app, method, path(base(orgId), accountId(fixtures)), user, body, admin);

          expect(response.status).toBe(404);
          expect(withoutTimestamp(response)).toEqual(reference);
        },
      );
    });

    it('answers the identical 404 on the debt list and create for a non-member :orgId', async () => {
      const list = await send(app, 'get', `/orgs/${BOB_ORG}/bank/accounts.json?type=debt`, ALICE).expect(404);
      const create = await send(app, 'post', `/orgs/${BOB_ORG}/bank/accounts.json`, ALICE, { type: 'debt', name: 'x' }).expect(404);

      [list, create].forEach((response) => expect(withoutTimestamp(response)).toEqual(reference));
    });

    it('changed nothing', () => {
      [fixtures.alicePersonal, fixtures.aliceOrg, fixtures.bobPersonal, fixtures.bobOrg].forEach((id) => {
        expect(repos.accounts.rows.find((row) => row.id === id)?.archivedAt).toBeNull();
        expect(detailsOf(id)?.dueDay).toBeNull();
      });
    });
  });

  describe('caching', () => {
    it('sends X-Skip-Cache and the user-scoped Cache-Control on GETs', async () => {
      const created = await createDebt(null);

      for (const path of ['/bank/accounts.json?type=debt', `/bank/accounts/${created.id}.json`]) {
        const response = await send(app, 'get', path, ALICE).expect(200);
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('private, no-store');
      }
    });

    it('marks writes as never', async () => {
      const created = await send(app, 'post', '/bank/accounts.json', ALICE, { type: 'debt', name: uniqueName('Cache') }).expect(201);
      const patched = await patch(null, created.body.id, { debt: { due_day: 3 } }).expect(200);

      [created, patched].forEach((response) => {
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });
  });
});

describe('debt accounts request / response logging (e2e)', () => {
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
        type: 'debt',
        name: 'Secret creditor loan',
        notes: 'secret-note-marker',
        debt: { instalment_amount: '4321.98', interest_rate: '7.6543', interest_period: 'yearly' },
      });
      await send(app, 'patch', `/bank/accounts/${created.id}.json`, ALICE, { debt: { instalment_count: 77 } }).expect(200);
      await send(app, 'get', `/bank/accounts/${created.id}.json`, ALICE).expect(200);
      await send(app, 'patch', `/bank/accounts/${created.id}.json`, ALICE, { debt: { due_day: 99 } }).expect(400);

      const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
      ['Secret creditor loan', 'secret-note-marker', '4321.98', '7.6543'].forEach((marker) => {
        expect(logged).not.toContain(marker);
      });
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
