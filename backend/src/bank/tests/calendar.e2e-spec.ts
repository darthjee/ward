import type { INestApplication } from '@nestjs/common';
import {
  ADMIN,
  ALICE,
  ALICE_ORG,
  base,
  BOB,
  BOB_ORG,
  buildBankTestApp,
  createAccount,
  NOT_FOUND_BODY,
  send,
} from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { ownerKeysIn } from './support/owner-matrix.js';
import { BillPayment } from '../entities/bill-payment.entity.js';
import { Bill } from '../entities/bill.entity.js';
import { todayUtc } from '../ledger-date.js';
import { addDays } from '../occurrence-generator.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

// Calendar and overdue routes (bills.md, *Routes and permissions*, and the decisions of #56):
// occurrence shape, status, sorting, totals, the 366-day cap, archived / hidden sources and the
// owner-context matrix. January 2026: the 5th is a Monday, the 10th a Saturday (effective 12th).

type Body = Record<string, unknown>;

const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];
const JANUARY = 'from=2026-01-01&to=2026-01-31';

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('calendar (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const source = async (orgId: number | null, type: string, nested: Body, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { type, name: uniqueName(type), [type]: nested, ...fields });
  const debt = (orgId: number | null, nested: Body = {}, fields: Body = {}) =>
    source(orgId, 'debt', { due_day: 10, instalment_amount: '500.00', bills_from: '2026-01-01', ...nested }, fields);
  const provider = (orgId: number | null, nested: Body = {}, fields: Body = {}) =>
    source(orgId, 'provider_expense', { due_day: 5, expected_amount: '200.00', bills_from: '2026-01-01', ...nested }, fields);
  const calendar = (orgId: number | null, query = JANUARY, user = ALICE) =>
    send(app, 'get', `${base(orgId)}/calendar.json?${query}`, user);
  const overdue = (orgId: number | null, user = ALICE) => send(app, 'get', `${base(orgId)}/calendar/overdue.json`, user);
  const addBill = (fields: Partial<Bill>) =>
    repos.bills.save(Object.assign(new Bill(), { payingAccountId: null, amount: 5000n, description: 'Tax', notes: null, ...fields }));
  const addPayment = (fields: Partial<BillPayment>) =>
    repos.billPayments.save(Object.assign(new BillPayment(), {
      billId: null,
      status: 'paid',
      paidOn: '2026-01-12',
      amount: 49000n,
      payingAccountId: null,
      paymentTransactionId: null,
      withdrawalTransactionId: null,
      chargeTransactionId: null,
      ...fields,
    }));
  const archive = (orgId: number | null, id: number) =>
    send(app, 'post', `${base(orgId)}/accounts/${id}/archive.json`, ALICE).expect(200);

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  beforeEach(() => {
    for (const repo of Object.values(repos) as Array<{ rows: unknown[] }>) {
      repo.rows.length = 0;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    describe('calendar.json', () => {
      it('answers derived occurrences in the occurrence shape, sorted by effective date', async () => {
        const paying = await createAccount(app, ALICE, orgId, { name: uniqueName('Checking') });
        const loan = await debt(orgId, { paying_account_id: paying.id });
        const fee = await provider(orgId);

        const response = await calendar(orgId).expect(200);

        expect(response.body.occurrences).toEqual([
          {
            kind: 'provider',
            source_account: { id: fee.id, name: fee.name, type: 'provider_expense' },
            bill: null,
            nominal_date: '2026-01-05',
            effective_date: '2026-01-05',
            expected_amount: '200.00',
            currency: 'BRL',
            status: 'overdue',
            payment: null,
            default_paying_account: null,
          },
          {
            kind: 'debt',
            source_account: { id: loan.id, name: loan.name, type: 'debt' },
            bill: null,
            nominal_date: '2026-01-10',
            effective_date: '2026-01-12',
            expected_amount: '500.00',
            currency: 'BRL',
            status: 'overdue',
            payment: null,
            default_paying_account: { id: paying.id, name: paying.name },
          },
        ]);
        expect(ownerKeysIn(response.body)).toEqual([]);
      });

      it('marks future occurrences open', async () => {
        await debt(orgId);

        const response = await calendar(orgId, 'from=2099-03-01&to=2099-03-31').expect(200);

        expect(response.body.occurrences.map((row: Body) => [row.nominal_date, row.status])).toEqual([['2099-03-10', 'open']]);
      });

      it('merges one-off bills (no weekend shift) and breaks ties by kind, source id, then bill id', async () => {
        const fee = await provider(orgId, { due_day: null });
        const loan = await debt(orgId);
        const second = await addBill({ providerAccountId: fee.id, dueDate: '2026-01-12', description: 'Second' });
        const first = await addBill({ providerAccountId: fee.id, dueDate: '2026-01-12', description: 'First' });
        await addBill({ providerAccountId: fee.id, dueDate: '2026-01-10', description: 'Saturday' });

        const response = await calendar(orgId).expect(200);

        expect(response.body.occurrences.map((row: Body) => [row.kind, row.effective_date, (row.bill as Body | null)?.id ?? null]))
          .toEqual([
            ['bill', '2026-01-10', expect.any(Number)],
            ['bill', '2026-01-12', Math.min(first.id, second.id)],
            ['bill', '2026-01-12', Math.max(first.id, second.id)],
            ['debt', '2026-01-12', null],
          ]);
        expect(response.body.occurrences[1]).toMatchObject({
          source_account: { id: fee.id, type: 'provider_expense' },
          bill: { description: 'Second' },
          nominal_date: '2026-01-12',
          expected_amount: '50.00',
        });
        expect(loan.id).toBeGreaterThan(0);
      });

      it('shows paid and skipped occurrences with their payment, and hides off-schedule payments', async () => {
        const paying = await createAccount(app, ALICE, orgId, { name: uniqueName('Checking') });
        const loan = await debt(orgId);
        const fee = await provider(orgId);
        await addPayment({ sourceAccountId: loan.id, dueDate: '2026-01-10', payingAccountId: paying.id });
        await addPayment({ sourceAccountId: fee.id, dueDate: '2026-01-05', status: 'skipped', paidOn: null, amount: null });
        await addPayment({ sourceAccountId: loan.id, dueDate: '2026-01-11' });

        const response = await calendar(orgId).expect(200);

        expect(response.body.occurrences).toHaveLength(2);
        expect(response.body.occurrences[0]).toMatchObject({
          status: 'skipped',
          payment: { status: 'skipped', paid_on: null, amount: null, paying_account: null },
        });
        expect(response.body.occurrences[1]).toMatchObject({
          status: 'paid',
          payment: { id: expect.any(Number), status: 'paid', paid_on: '2026-01-12', amount: '490.00', paying_account: { id: paying.id, name: paying.name } },
        });
      });

      it('computes per-currency totals (expected, paid, open), never summed across currencies', async () => {
        const loan = await debt(orgId);
        const fee = await provider(orgId);
        await provider(orgId, { expected_amount: null, due_day: 20 });
        await provider(orgId, { expected_amount: '10.00', due_day: 15 }, { currency: 'USD' });
        await addPayment({ sourceAccountId: loan.id, dueDate: '2026-01-10', amount: 49000n });
        await addPayment({ sourceAccountId: fee.id, dueDate: '2026-01-05', status: 'skipped', paidOn: null, amount: null });

        const response = await calendar(orgId).expect(200);

        expect(response.body.totals).toEqual([
          { currency: 'BRL', expected: '700.00', paid: '490.00', open: '0.00' },
          { currency: 'USD', expected: '10.00', paid: '0.00', open: '10.00' },
        ]);
      });

      it('answers an empty envelope for an empty range', async () => {
        await debt(orgId);

        const response = await calendar(orgId, 'from=2026-01-13&to=2026-02-09').expect(200);

        expect(response.body).toEqual({ occurrences: [], totals: [] });
      });

      it('hides archived sources, hidden schedules, and the one-off bills of archived providers', async () => {
        const archivedDebt = await debt(orgId);
        await debt(orgId, { show_in_calendar: false });
        const archivedProvider = await provider(orgId, { due_day: null });
        await addBill({ providerAccountId: archivedProvider.id, dueDate: '2026-01-15' });
        await archive(orgId, archivedDebt.id);
        await archive(orgId, archivedProvider.id);

        expect((await calendar(orgId).expect(200)).body.occurrences).toEqual([]);

        await send(app, 'post', `${base(orgId)}/accounts/${archivedProvider.id}/unarchive.json`, ALICE).expect(200);
        expect((await calendar(orgId).expect(200)).body.occurrences).toHaveLength(1);
      });

      it.each([
        ['a missing from', 'to=2026-01-31'],
        ['a missing to', 'from=2026-01-01'],
        ['an invalid date', 'from=2026-02-30&to=2026-03-31'],
        ['a malformed date', 'from=01/01/2026&to=2026-03-31'],
        ['a repeated parameter', 'from=2026-01-01&from=2026-01-02&to=2026-03-31'],
        ['from after to', 'from=2026-02-01&to=2026-01-31'],
        ['a range over 366 days', 'from=2026-01-01&to=2027-01-03'],
      ])('answers 400 for %s', async (_label, query) => {
        const response = await calendar(orgId, query).expect(400);

        expect(response.body.error.code).toBe('VALIDATION_FAILED');
      });

      it('accepts a 366-day range and a single day', async () => {
        await calendar(orgId, 'from=2026-01-01&to=2027-01-02').expect(200);
        await calendar(orgId, 'from=2026-01-12&to=2026-01-12').expect(200);
      });

      it('sends X-Cache-Allow and the user-scoped Cache-Control', async () => {
        const response = await calendar(orgId).expect(200);

        expect(response.headers['x-cache-allow']).toBe('true');
        expect(response.headers['x-skip-cache']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store');
      });
    });

    describe('calendar/overdue.json', () => {
      it('lists only open past occurrences, oldest first, with { currency, open } totals', async () => {
        const today = todayUtc(new Date());
        const billsFrom = addDays(today, -70);
        const loan = await debt(orgId, { due_day: 1, bills_from: billsFrom });
        const fee = await provider(orgId, { due_day: null });
        await addBill({ providerAccountId: fee.id, dueDate: addDays(today, -1), amount: 1234n });
        await addBill({ providerAccountId: fee.id, dueDate: today });
        const paidBill = await addBill({ providerAccountId: fee.id, dueDate: addDays(today, -3) });
        await addPayment({ sourceAccountId: fee.id, billId: paidBill.id, dueDate: paidBill.dueDate });

        const response = await overdue(orgId).expect(200);
        const rows = response.body.occurrences as Body[];

        expect(rows.length).toBeGreaterThanOrEqual(3);
        rows.forEach((row) => {
          expect(row.status).toBe('overdue');
          expect(row.effective_date < today).toBe(true);
          expect(row.nominal_date >= billsFrom).toBe(true);
        });
        expect(rows.map((row) => row.effective_date)).toEqual([...rows.map((row) => row.effective_date)].sort());
        expect(rows.filter((row) => row.kind === 'bill')).toEqual([expect.objectContaining({ expected_amount: '12.34' })]);
        expect(rows.filter((row) => row.kind === 'debt').every((row) => (row.source_account as Body).id === loan.id)).toBe(true);
        expect(response.body.totals).toEqual([
          { currency: 'BRL', open: ((rows.length - 1) * 500 + 12.34).toFixed(2) },
        ]);
      });

      it('drops a paid or skipped occurrence from the overdue list', async () => {
        const loan = await debt(orgId, { bills_from: '2026-01-01', due_day: 10 });
        await addPayment({ sourceAccountId: loan.id, dueDate: '2026-01-10' });
        await addPayment({ sourceAccountId: loan.id, dueDate: '2026-02-10', status: 'skipped', paidOn: null, amount: null });

        const response = await overdue(orgId).expect(200);
        const nominals = response.body.occurrences.map((row: Body) => row.nominal_date);

        expect(nominals).not.toContain('2026-01-10');
        expect(nominals).not.toContain('2026-02-10');
        expect(nominals).toContain('2026-03-10');
      });

      it('answers an empty envelope when nothing is overdue', async () => {
        await debt(orgId, { bills_from: '2099-01-01' });

        expect((await overdue(orgId).expect(200)).body).toEqual({ occurrences: [], totals: [] });
      });
    });
  });

  describe('owner contexts', () => {
    it('never shows organization bills on the Personal calendar, nor personal ones on the organization\'s', async () => {
      const personal = await debt(null);
      const organization = await debt(ALICE_ORG);
      await source(null, 'debt', { due_day: 10, bills_from: '2026-01-01' }, {}, BOB);
      await source(BOB_ORG, 'debt', { due_day: 10, bills_from: '2026-01-01' }, {}, BOB);

      const ids = async (orgId: number | null) =>
        (await calendar(orgId).expect(200)).body.occurrences.map((row: Body) => (row.source_account as Body).id);
      const overdueIds = async (orgId: number | null) =>
        (await overdue(orgId).expect(200)).body.occurrences.map((row: Body) => (row.source_account as Body).id);

      expect(await ids(null)).toEqual([personal.id]);
      expect(await ids(ALICE_ORG)).toEqual([organization.id]);
      expect(new Set(await overdueIds(null))).toEqual(new Set([personal.id]));
      expect(new Set(await overdueIds(ALICE_ORG))).toEqual(new Set([organization.id]));
    });

    it.each([
      ['a non-member :orgId', ALICE, false, BOB_ORG],
      ['a global admin who is not a member', ADMIN, true, ALICE_ORG],
    ])('answers the uniform 404 for %s on both routes', async (_label, user, admin, orgId) => {
      const calendarResponse = await send(app, 'get', `${base(orgId)}/calendar.json?${JANUARY}`, user, undefined, admin).expect(404);
      const overdueResponse = await send(app, 'get', `${base(orgId)}/calendar/overdue.json`, user, undefined, admin).expect(404);

      expect(calendarResponse.body).toEqual(NOT_FOUND_BODY);
      expect(overdueResponse.body).toEqual(NOT_FOUND_BODY);
    });

    it('shows a global admin only their own (empty) Personal calendar', async () => {
      await debt(null);

      const response = await send(app, 'get', `/bank/calendar.json?${JANUARY}`, ADMIN, undefined, true).expect(200);

      expect(response.body).toEqual({ occurrences: [], totals: [] });
    });

    it('never shows Alice\'s personal bills to Bob', async () => {
      await debt(null);

      expect((await calendar(null, JANUARY, BOB).expect(200)).body.occurrences).toEqual([]);
    });
  });
});
