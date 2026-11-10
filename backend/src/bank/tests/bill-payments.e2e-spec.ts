import type { INestApplication } from '@nestjs/common';
import { todayUtc } from '../ledger-date.js';
import { addDays } from '../occurrence-generator.js';
import {
  ADMIN,
  ALICE,
  ALICE_ORG,
  base,
  beforeNextTransaction,
  BOB,
  BOB_ORG,
  buildBankTestApp,
  createAccount,
  NOT_FOUND_BODY,
  send,
  withoutTimestamp,
} from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { ownerKeysIn } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../accountant-charges.query.js', () => jest.requireActual('./support/in-memory-accountant-charges.query.js'));

// Pay / skip / undo (bills.md, *Paying a bill*, and the decisions of #56). January 2026: the
// debt is due on the 10th (a Saturday, effective the 12th), the provider on the 5th.

type Body = Record<string, unknown>;

const ACCOUNT_NOT_FOUND = { error: { code: 'ACCOUNT_NOT_FOUND', message: 'account not found' }, statusCode: 422 };
const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('bill payments (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const regular = (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { name: uniqueName('Checking'), opening_date: '2026-01-01', ...fields });
  const debt = (orgId: number | null, nested: Body = {}, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, {
      type: 'debt',
      name: uniqueName('Loan'),
      debt: { due_day: 10, instalment_amount: '500.00', bills_from: '2026-01-01', ...nested },
      ...fields,
    });
  const provider = (orgId: number | null, nested: Body = {}, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, {
      type: 'provider_expense',
      name: uniqueName('Vivo'),
      provider_expense: { due_day: 5, expected_amount: '200.00', bills_from: '2026-01-01', ...nested },
      ...fields,
    });
  const occurrencePath = (orgId: number | null, accountId: number | string, dueDate: string) =>
    `${base(orgId)}/accounts/${accountId}/occurrences/${dueDate}/payment.json`;
  const billPaymentPath = (orgId: number | null, id: number | string) => `${base(orgId)}/bills/${id}/payment.json`;
  const pay = (orgId: number | null, accountId: number | string, dueDate: string, body: Body, user = ALICE) =>
    send(app, 'post', occurrencePath(orgId, accountId, dueDate), user, body);
  const undo = (orgId: number | null, accountId: number | string, dueDate: string, user = ALICE) =>
    send(app, 'delete', occurrencePath(orgId, accountId, dueDate), user);
  const paid = (payingId: number, fields: Body = {}) =>
    ({ status: 'paid', paid_on: '2026-01-12', amount: '490.00', paying_account_id: payingId, ...fields });
  const createBill = async (orgId: number | null, providerId: number, payingId: number, fields: Body = {}) =>
    (await send(app, 'post', `${base(orgId)}/bills.json`, ALICE, {
      provider_account_id: providerId,
      paying_account_id: payingId,
      due_date: '2026-01-20',
      amount: '80.00',
      description: 'IPVA',
      ...fields,
    }).expect(201)).body;
  const ledgerOf = (accountId: number) =>
    repos.transactions.rows.filter((row) => row.accountId === accountId).map(({ date, amount, description }) => ({ date, amount, description }));
  const calendarRow = async (orgId: number | null, accountId: number, query = 'from=2026-01-01&to=2026-01-31') =>
    ((await send(app, 'get', `${base(orgId)}/calendar.json?${query}`, ALICE).expect(200)).body.occurrences as Body[])
      .find((row) => (row.source_account as Body).id === accountId && row.kind !== 'bill');
  const archive = (orgId: number | null, id: number) =>
    send(app, 'post', `${base(orgId)}/accounts/${id}/archive.json`, ALICE).expect(200);
  const unarchive = (orgId: number | null, id: number) =>
    send(app, 'post', `${base(orgId)}/accounts/${id}/unarchive.json`, ALICE).expect(200);

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    describe('pay', () => {
      it('pays a debt occurrence: + on the debt, − on the paying account, dated paid_on, described', async () => {
        const checking = await regular(orgId);
        const loan = await debt(orgId, {}, { name: 'Car loan' + uniqueName('') });

        const response = await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(201);

        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({
          kind: 'debt',
          source_account: { id: loan.id, name: loan.name, type: 'debt' },
          bill: null,
          nominal_date: '2026-01-10',
          effective_date: '2026-01-12',
          expected_amount: '500.00',
          currency: 'BRL',
          status: 'paid',
          payment: {
            id: expect.any(Number),
            status: 'paid',
            paid_on: '2026-01-12',
            amount: '490.00',
            paying_account: { id: checking.id, name: checking.name },
          },
          default_paying_account: null,
        });
        expect(ownerKeysIn(response.body)).toEqual([]);
        const description = `${loan.name} — 2026-01-10`;
        expect(ledgerOf(loan.id)).toEqual([{ date: '2026-01-12', amount: 49000n, description }]);
        expect(ledgerOf(checking.id)).toEqual([{ date: '2026-01-12', amount: -49000n, description }]);
        expect(await calendarRow(orgId, loan.id)).toMatchObject({ status: 'paid' });
      });

      it('truncates a long description by code points, keeping the date', async () => {
        const checking = await regular(orgId);
        const loan = await debt(orgId, {}, { name: '😀'.repeat(240) + uniqueName('') });

        await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(201);

        const [{ description }] = ledgerOf(loan.id);
        expect([...description]).toHaveLength(255);
        expect(description.endsWith(' — 2026-01-10')).toBe(true);
      });

      it('pays a provider occurrence with the charge by default, and the charge reaches the hand-off', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);

        await pay(orgId, fee.id, '2026-01-05', paid(checking.id, { paid_on: '2026-01-06', amount: '200.00' })).expect(201);

        expect(ledgerOf(fee.id).map(({ amount }) => amount)).toEqual([20000n, -20000n]);
        expect(ledgerOf(checking.id).map(({ amount }) => amount)).toEqual([-20000n]);
        const preview = await send(app, 'get', `${base(orgId)}/accountant/charges.json?from=2026-01-01&to=2026-01-31`, ALICE).expect(200);
        expect(preview.body.charges).toEqual([
          expect.objectContaining({ date: '2026-01-06', amount: '-200.00', sent_to_accountant_at: null, account: expect.objectContaining({ id: fee.id }) }),
        ]);
      });

      it('pays a provider occurrence without the charge when record_charge is false', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);

        await pay(orgId, fee.id, '2026-01-05', paid(checking.id, { record_charge: false })).expect(201);

        expect(ledgerOf(fee.id).map(({ amount }) => amount)).toEqual([49000n]);
      });

      it('pays a one-off bill (no shift), described with the bill description, with and without the charge', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId, { due_day: null });
        const withCharge = await createBill(orgId, fee.id, checking.id);
        const withoutCharge = await createBill(orgId, fee.id, checking.id, { description: 'Fine' });

        const response = await send(app, 'post', billPaymentPath(orgId, withCharge.id), ALICE, paid(checking.id)).expect(201);
        await send(app, 'post', billPaymentPath(orgId, withoutCharge.id), ALICE, paid(checking.id, { record_charge: false })).expect(201);

        expect(response.body).toMatchObject({
          kind: 'bill',
          bill: { id: withCharge.id, description: 'IPVA' },
          nominal_date: '2026-01-20',
          effective_date: '2026-01-20',
          status: 'paid',
          default_paying_account: { id: checking.id },
        });
        expect(ledgerOf(fee.id)).toEqual([
          { date: '2026-01-12', amount: 49000n, description: 'IPVA — 2026-01-20' },
          { date: '2026-01-12', amount: -49000n, description: 'IPVA — 2026-01-20' },
          { date: '2026-01-12', amount: 49000n, description: 'Fine — 2026-01-20' },
        ]);
        const shown = await send(app, 'get', `${base(orgId)}/bills/${withCharge.id}.json`, ALICE).expect(200);
        expect(shown.body.payment).toMatchObject({ status: 'paid', amount: '490.00' });
      });

      it('skips without writing transactions; a skipped occurrence is neither open nor overdue', async () => {
        const loan = await debt(orgId);

        const response = await pay(orgId, loan.id, '2026-01-10', { status: 'skipped' }).expect(201);

        expect(response.body).toMatchObject({ status: 'skipped', payment: { status: 'skipped', paid_on: null, amount: null, paying_account: null } });
        expect(ledgerOf(loan.id)).toEqual([]);
        const overdue = await send(app, 'get', `${base(orgId)}/calendar/overdue.json`, ALICE).expect(200);
        expect(overdue.body.occurrences.map((row: Body) => row.nominal_date)).not.toContain('2026-01-10');
      });

      it('answers 409 when paying twice, writing nothing more', async () => {
        const checking = await regular(orgId);
        const loan = await debt(orgId);
        await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(201);

        const response = await pay(orgId, loan.id, '2026-01-10', { status: 'skipped' }).expect(409);

        expect(response.body.error.code).toBe('OCCURRENCE_ALREADY_PAID');
        expect(ledgerOf(loan.id)).toHaveLength(1);
        const bill = await createBill(orgId, (await provider(orgId)).id, checking.id);
        await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, { status: 'skipped' }).expect(201);
        await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, { status: 'skipped' }).expect(409);
      });

      it('answers the uniform 404 for dates that are not an occurrence', async () => {
        const loan = await debt(orgId);
        const hidden = await debt(orgId, { show_in_calendar: false });
        const archived = await debt(orgId);
        const unscheduled = await debt(orgId, { due_day: null });
        await archive(orgId, archived.id);

        for (const [id, date] of [
          [loan.id, '2026-01-11'],
          [loan.id, '2026-01-12'],
          [loan.id, '2025-12-10'],
          [loan.id, '2026-02-30'],
          [loan.id, 'abc'],
          [hidden.id, '2026-01-10'],
          [archived.id, '2026-01-10'],
          [unscheduled.id, '2026-01-10'],
        ] as const) {
          expect((await pay(orgId, id, date, { status: 'skipped' }).expect(404)).body).toEqual(NOT_FOUND_BODY);
        }
      });

      it.each([
        ['an unknown field', { status: 'skipped', note: 'x' }],
        ['an owner field', { status: 'skipped', user_id: 7 }],
        ['extra fields on a skip', { status: 'skipped', amount: '1.00' }],
        ['a missing status', {}],
        ['an unknown status', { status: 'partial' }],
        ['a paid body without paid_on', { status: 'paid', amount: '1.00', paying_account_id: 1 }],
        ['a paid body without amount', { status: 'paid', paid_on: '2026-01-12', paying_account_id: 1 }],
        ['a paid body without paying_account_id', { status: 'paid', paid_on: '2026-01-12', amount: '1.00' }],
        ['a zero amount', { status: 'paid', paid_on: '2026-01-12', amount: '0', paying_account_id: 1 }],
        ['too many decimals', { status: 'paid', paid_on: '2026-01-12', amount: '1.001', paying_account_id: 1 }],
        ['paid_on after tomorrow', { status: 'paid', paid_on: addDays(todayUtc(new Date()), 2), amount: '1.00', paying_account_id: 1 }],
        ['record_charge on a debt', { status: 'paid', paid_on: '2026-01-12', amount: '1.00', paying_account_id: 1, record_charge: true }],
      ])('answers 400 for %s', async (_label, body) => {
        const loan = await debt(orgId);

        await pay(orgId, loan.id, '2026-01-10', body).expect(400);
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === loan.id)).toBe(false);
      });

      it('answers one generic 422 for every invalid paying_account_id, and 422 currency mismatch', async () => {
        const fee = await provider(orgId);
        const otherContext = await regular(orgId === null ? ALICE_ORG : null);
        const bobs = await regular(null, {}, BOB);
        const nonRegular = await debt(orgId);
        const archived = await regular(orgId);
        await archive(orgId, archived.id);

        const bodies = [];
        for (const id of [999999, otherContext.id, bobs.id, nonRegular.id, archived.id]) {
          bodies.push(withoutTimestamp(await pay(orgId, fee.id, '2026-01-05', paid(id)).expect(422)));
        }
        bodies.forEach((body) => expect(body).toEqual(ACCOUNT_NOT_FOUND));

        const usd = await regular(orgId, { currency: 'USD' });
        const mismatch = await pay(orgId, fee.id, '2026-01-05', paid(usd.id)).expect(422);
        expect(mismatch.body.error).toEqual({ code: 'CURRENCY_MISMATCH', message: 'currency mismatch' });
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === fee.id)).toBe(false);
      });
    });

    describe('races past the pre-checks (re-checked under row locks inside the write)', () => {
      const archiveNow = (id: number) => () => {
        (repos.accounts.rows.find((row) => row.id === id) as { archivedAt: Date | null }).archivedAt = new Date();
      };

      it('answers 404 when the one-off bill is deleted meanwhile, writing nothing', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId, { due_day: null });
        const bill = await createBill(orgId, fee.id, checking.id);
        const locks = repos.bills.locks.length;
        beforeNextTransaction(app, () => repos.bills.delete({ id: bill.id }));

        const response = await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, paid(checking.id)).expect(404);

        expect(response.body).toEqual(NOT_FOUND_BODY);
        expect(repos.bills.locks.slice(locks)).toEqual(['pessimistic_write']);
        expect(ledgerOf(fee.id)).toEqual([]);
        expect(ledgerOf(checking.id)).toEqual([]);
        expect(repos.billPayments.rows.some((row) => row.billId === bill.id)).toBe(false);
      });

      it('answers 422 when the paying account is archived meanwhile, on a derived occurrence and a one-off bill', async () => {
        const checking = await regular(orgId);
        const loan = await debt(orgId);
        const locks = repos.accounts.locks.length;
        beforeNextTransaction(app, archiveNow(checking.id));

        const derived = await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(422);

        expect(withoutTimestamp(derived)).toEqual(ACCOUNT_NOT_FOUND);
        expect(repos.accounts.locks.slice(locks)).toEqual(['pessimistic_read']);
        expect(ledgerOf(checking.id)).toEqual([]);
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === loan.id)).toBe(false);

        const other = await regular(orgId);
        const fee = await provider(orgId, { due_day: null });
        const bill = await createBill(orgId, fee.id, other.id);
        beforeNextTransaction(app, archiveNow(other.id));
        const oneOff = await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, paid(other.id)).expect(422);
        expect(withoutTimestamp(oneOff)).toEqual(ACCOUNT_NOT_FOUND);
        expect(ledgerOf(fee.id)).toEqual([]);
        expect(repos.billPayments.rows.some((row) => row.billId === bill.id)).toBe(false);
      });

      it('does not re-check a paying account for a skip', async () => {
        const loan = await debt(orgId);
        const locks = repos.accounts.locks.length;

        await pay(orgId, loan.id, '2026-01-10', { status: 'skipped' }).expect(201);

        expect(repos.accounts.locks.length).toBe(locks);
      });
    });

    describe('undo', () => {
      it('deletes the row and only the linked transactions that still exist; the occurrence is open / overdue again', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        const unrelated = (await send(app, 'post', `${base(orgId)}/accounts/${fee.id}/transactions.json`, ALICE, {
          date: '2026-01-02',
          amount: '-1.00',
          description: 'Manual',
        }).expect(201)).body.id;
        await pay(orgId, fee.id, '2026-01-05', paid(checking.id)).expect(201);
        const withdrawal = repos.transactions.rows.find((row) => row.accountId === checking.id)?.id as number;
        await send(app, 'delete', `${base(orgId)}/accounts/${checking.id}/transactions/${withdrawal}.json`, ALICE).expect(204);

        const response = await undo(orgId, fee.id, '2026-01-05').expect(204);

        expect(response.headers['cache-control']).toBe('no-store');
        expect(repos.transactions.rows.filter((row) => row.accountId === fee.id).map(({ id }) => id)).toEqual([unrelated]);
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === fee.id)).toBe(false);
        expect(await calendarRow(orgId, fee.id)).toMatchObject({ status: 'overdue', payment: null });
      });

      it('deletes a charge already sent to the accountant', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        await pay(orgId, fee.id, '2026-01-05', paid(checking.id)).expect(201);
        const charge = repos.transactions.rows.find((row) => row.accountId === fee.id && row.amount < 0n);
        if (charge) charge.sentToAccountantAt = new Date();

        await undo(orgId, fee.id, '2026-01-05').expect(204);

        expect(ledgerOf(fee.id)).toEqual([]);
      });

      it('undoes a skip, and a one-off bill payment', async () => {
        const checking = await regular(orgId);
        const loan = await debt(orgId);
        const fee = await provider(orgId);
        const bill = await createBill(orgId, fee.id, checking.id);
        await pay(orgId, loan.id, '2026-01-10', { status: 'skipped' }).expect(201);
        await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, paid(checking.id)).expect(201);

        await undo(orgId, loan.id, '2026-01-10').expect(204);
        await send(app, 'delete', billPaymentPath(orgId, bill.id), ALICE).expect(204);

        expect(ledgerOf(fee.id)).toEqual([]);
        expect(repos.billPayments.rows.some((row) => [loan.id, fee.id].includes(row.sourceAccountId))).toBe(false);
        expect((await send(app, 'get', `${base(orgId)}/bills/${bill.id}.json`, ALICE).expect(200)).body.payment).toBeNull();
      });

      it('answers 404 when there is no payment', async () => {
        const loan = await debt(orgId);
        const checking = await regular(orgId);
        const bill = await createBill(orgId, (await provider(orgId)).id, checking.id);

        expect((await undo(orgId, loan.id, '2026-01-10').expect(404)).body).toEqual(NOT_FOUND_BODY);
        expect((await undo(orgId, loan.id, 'abc').expect(404)).body).toEqual(NOT_FOUND_BODY);
        await send(app, 'delete', billPaymentPath(orgId, bill.id), ALICE).expect(404);
      });

      it('undoes an off-schedule payment after a schedule edit', async () => {
        const checking = await regular(orgId);
        const loan = await debt(orgId);
        await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(201);
        await send(app, 'patch', `${base(orgId)}/accounts/${loan.id}.json`, ALICE, { debt: { due_day: 15 } }).expect(200);

        await undo(orgId, loan.id, '2026-01-10').expect(204);
      });

      describe('archived accounts', () => {
        it('answers 409 for a payment whose source account is archived', async () => {
          const checking = await regular(orgId);
          const loan = await debt(orgId);
          await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(201);
          await archive(orgId, loan.id);

          expect((await undo(orgId, loan.id, '2026-01-10').expect(409)).body.error.code).toBe('ACCOUNT_ARCHIVED');
          await unarchive(orgId, loan.id);
          await undo(orgId, loan.id, '2026-01-10').expect(204);
        });

        it('answers 409 for a payment whose paying account is archived', async () => {
          const checking = await regular(orgId);
          const loan = await debt(orgId);
          const fee = await provider(orgId);
          const bill = await createBill(orgId, fee.id, checking.id);
          await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(201);
          await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, paid(checking.id)).expect(201);
          await archive(orgId, checking.id);

          expect((await undo(orgId, loan.id, '2026-01-10').expect(409)).body.error.code).toBe('ACCOUNT_ARCHIVED');
          await send(app, 'delete', billPaymentPath(orgId, bill.id), ALICE).expect(409);
        });

        it('answers 404 for a skip whose source account is archived', async () => {
          const loan = await debt(orgId);
          await pay(orgId, loan.id, '2026-01-10', { status: 'skipped' }).expect(201);
          await archive(orgId, loan.id);

          expect((await undo(orgId, loan.id, '2026-01-10').expect(404)).body).toEqual(NOT_FOUND_BODY);
        });

        it('answers 404 for a one-off bill whose provider is archived', async () => {
          const checking = await regular(orgId);
          const fee = await provider(orgId);
          const bill = await createBill(orgId, fee.id, checking.id);
          await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, paid(checking.id)).expect(201);
          await archive(orgId, fee.id);

          expect((await send(app, 'delete', billPaymentPath(orgId, bill.id), ALICE).expect(404)).body).toEqual(NOT_FOUND_BODY);
          await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, { status: 'skipped' }).expect(404);
        });
      });
    });

    describe('bill history', () => {
      const history = (accountId: number | string, query = '') =>
        send(app, 'get', `${base(orgId)}/accounts/${accountId}/bill-payments.json${query}`, ALICE);

      it('keeps off-schedule payments after a schedule edit, listed but absent from the calendar, back when changed back', async () => {
        const checking = await regular(orgId);
        const loan = await debt(orgId);
        await pay(orgId, loan.id, '2026-01-10', paid(checking.id)).expect(201);
        const patchDueDay = (dueDay: number) =>
          send(app, 'patch', `${base(orgId)}/accounts/${loan.id}.json`, ALICE, { debt: { due_day: dueDay } }).expect(200);

        await patchDueDay(15);
        const moved = await history(loan.id).expect(200);
        expect(moved.body.payments).toEqual([{
          id: expect.any(Number),
          status: 'paid',
          paid_on: '2026-01-12',
          amount: '490.00',
          paying_account: { id: checking.id, name: checking.name },
          due_date: '2026-01-10',
          bill: null,
          off_schedule: true,
        }]);
        expect(await calendarRow(orgId, loan.id)).toMatchObject({ nominal_date: '2026-01-15', payment: null });

        await patchDueDay(10);
        expect((await history(loan.id).expect(200)).body.payments[0].off_schedule).toBe(false);
        expect(await calendarRow(orgId, loan.id)).toMatchObject({ nominal_date: '2026-01-10', status: 'paid' });
      });

      it('lists derived and one-off rows of a provider, newest due date first, with no owner fields', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        const bill = await createBill(orgId, fee.id, checking.id, { due_date: '2026-03-01' });
        await pay(orgId, fee.id, '2026-01-05', { status: 'skipped' }).expect(201);
        await pay(orgId, fee.id, '2026-02-05', paid(checking.id)).expect(201);
        await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, { status: 'skipped' }).expect(201);

        const response = await history(fee.id).expect(200);

        expect(response.body.payments.map((row: Body) => [row.due_date, row.status, row.bill, row.off_schedule])).toEqual([
          ['2026-03-01', 'skipped', { id: bill.id, description: 'IPVA' }, false],
          ['2026-02-05', 'paid', null, false],
          ['2026-01-05', 'skipped', null, false],
        ]);
        expect(response.body.pagination).toEqual({ page: 1, per_page: 50, total_pages: 1, total_count: 3 });
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(ownerKeysIn(response.body)).toEqual([]);
      });

      it('paginates 50 per page and answers 400 for an invalid page', async () => {
        const loan = await debt(orgId);
        for (let index = 0; index < 51; index++) {
          const year = 2026 + Math.floor(index / 12);
          const month = String((index % 12) + 1).padStart(2, '0');
          await pay(orgId, loan.id, `${year}-${month}-10`, { status: 'skipped' }).expect(201);
        }

        const second = await history(loan.id, '?page=2').expect(200);

        expect(second.body.payments).toHaveLength(1);
        expect(second.body.pagination).toEqual({ page: 2, per_page: 50, total_pages: 2, total_count: 51 });
        expect((await history(loan.id, '?page=3').expect(200)).body.payments).toEqual([]);
        await history(loan.id, '?page=0').expect(400);
        await history(loan.id, '?page=x').expect(400);
      });

      it('keeps the history of an archived account readable, like its ledger', async () => {
        const loan = await debt(orgId);
        await pay(orgId, loan.id, '2026-01-10', { status: 'skipped' }).expect(201);
        await archive(orgId, loan.id);

        expect((await history(loan.id).expect(200)).body.payments).toHaveLength(1);
      });

      it('answers the uniform 404 for a regular or investment account', async () => {
        const checking = await regular(orgId);
        const investment = await createAccount(app, ALICE, orgId, { type: 'investment', name: uniqueName('CDB'), opening_balance: '0' });

        expect((await history(checking.id).expect(404)).body).toEqual(NOT_FOUND_BODY);
        expect((await history(investment.id).expect(404)).body).toEqual(NOT_FOUND_BODY);
      });
    });
  });

  describe('owner contexts', () => {
    type Owned = { debt: number; bill: number };
    const owned: Record<string, Owned> = {};

    beforeAll(async () => {
      for (const [key, user, orgId] of [
        ['alicePersonal', ALICE, null],
        ['aliceOrg', ALICE, ALICE_ORG],
        ['bobPersonal', BOB, null],
        ['bobOrg', BOB, BOB_ORG],
      ] as const) {
        const checking = await regular(orgId, {}, user);
        const fee = await provider(orgId, { due_day: null }, {}, user);
        const bill = (await send(app, 'post', `${base(orgId)}/bills.json`, user, {
          provider_account_id: fee.id,
          paying_account_id: checking.id,
          due_date: '2026-01-20',
          amount: '1.00',
          description: 'x',
        }).expect(201)).body.id;
        owned[key] = { debt: (await debt(orgId, {}, {}, user)).id, bill };
      }
    });

    const CASES: Array<[string, string, boolean, number | null, string]> = [
      ['an unknown id', ALICE, false, null, 'unknown'],
      ['another user\'s personal record', ALICE, false, null, 'bobPersonal'],
      ['an organization record on a personal route', ALICE, false, null, 'aliceOrg'],
      ['a personal record on an organization route', ALICE, false, ALICE_ORG, 'alicePersonal'],
      ['another organization\'s record', ALICE, false, ALICE_ORG, 'bobOrg'],
      ['a non-member :orgId', ALICE, false, BOB_ORG, 'bobOrg'],
      ['a global admin on another user\'s personal record', ADMIN, true, null, 'alicePersonal'],
      ['a global admin who is not a member', ADMIN, true, ALICE_ORG, 'aliceOrg'],
    ];

    it.each(CASES)('answers the uniform 404 on all five routes for %s', async (_label, user, admin, orgId, key) => {
      const ids = owned[key] ?? { debt: 999999, bill: 999999 };
      const responses = [
        await send(app, 'post', occurrencePath(orgId, ids.debt, '2026-01-10'), user, { status: 'skipped' }, admin),
        await send(app, 'delete', occurrencePath(orgId, ids.debt, '2026-01-10'), user, undefined, admin),
        await send(app, 'post', billPaymentPath(orgId, ids.bill), user, { status: 'skipped' }, admin),
        await send(app, 'delete', billPaymentPath(orgId, ids.bill), user, undefined, admin),
        await send(app, 'get', `${base(orgId)}/accounts/${ids.debt}/bill-payments.json`, user, undefined, admin),
      ];

      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual(NOT_FOUND_BODY);
      }
      const ownedDebts = Object.values(owned).map(({ debt: id }) => id);
      expect(repos.billPayments.rows.some((row) => ownedDebts.includes(row.sourceAccountId))).toBe(false);
    });

    it('answers the uniform 404 for a non-numeric id and a regular account', async () => {
      const checking = await regular(null);

      for (const path of [occurrencePath(null, 'abc', '2026-01-10'), occurrencePath(null, checking.id, '2026-01-10'), billPaymentPath(null, 'abc')]) {
        expect((await send(app, 'post', path, ALICE, { status: 'skipped' }).expect(404)).body).toEqual(NOT_FOUND_BODY);
      }
      expect((await send(app, 'get', '/bank/accounts/abc/bill-payments.json', ALICE).expect(404)).body).toEqual(NOT_FOUND_BODY);
    });
  });
});
