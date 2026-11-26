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
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));
jest.mock('../accountant-charges.query.js', () => jest.requireActual('./support/in-memory-accountant-charges.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));

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
  // A provider with one recurring bill named after it (none when `due_day` is null), added through
  // `/provider-bills.json`: the provider itself carries no schedule.
  const provider = async (orgId: number | null, schedule: Body = {}, fields: Body = {}, user = ALICE) => {
    const account = await createAccount(app, user, orgId, { type: 'provider_expense', name: uniqueName('Vivo'), ...fields });
    const bill = Object.fromEntries(Object.entries({ due_day: 5, expected_amount: '200.00', bills_from: '2026-01-01', ...schedule })
      .filter(([, value]) => value !== null));

    if (bill.due_day !== undefined) {
      await send(app, 'post', `${base(orgId)}/accounts/${account.id}/provider-bills.json`, user, { kind: 'recurring', description: account.name, ...bill })
        .expect(201);
    }

    return account;
  };
  const occurrencePath = (orgId: number | null, accountId: number | string, dueDate: string) =>
    `${base(orgId)}/accounts/${accountId}/occurrences/${dueDate}/payment.json`;
  const billPaymentPath = (orgId: number | null, id: number | string) => `${base(orgId)}/bills/${id}/payment.json`;
  const pay = (orgId: number | null, accountId: number | string, dueDate: string, body: Body, user = ALICE) =>
    send(app, 'post', occurrencePath(orgId, accountId, dueDate), user, body);
  const undo = (orgId: number | null, accountId: number | string, dueDate: string, user = ALICE) =>
    send(app, 'delete', occurrencePath(orgId, accountId, dueDate), user);
  const perBillPath = (orgId: number | null, id: number | string, dueDate: string) =>
    `${base(orgId)}/provider-bills/${id}/occurrences/${dueDate}/payment.json`;
  const payBill = (orgId: number | null, id: number | string, dueDate: string, body: Body, user = ALICE) =>
    send(app, 'post', perBillPath(orgId, id, dueDate), user, body);
  const undoBill = (orgId: number | null, id: number | string, dueDate: string, user = ALICE) =>
    send(app, 'delete', perBillPath(orgId, id, dueDate), user);
  const recurringOf = (providerId: number) =>
    repos.bills.rows.filter((row) => row.providerAccountId === providerId && row.kind === 'recurring');
  // The id of the provider's only recurring bill (added by `provider()`).
  const billOf = (providerId: number): number => recurringOf(providerId)[0].id;
  const addRecurring = async (orgId: number | null, providerId: number, fields: Body = {}) =>
    (await send(app, 'post', `${base(orgId)}/accounts/${providerId}/provider-bills.json`, ALICE, {
      kind: 'recurring', description: uniqueName('Plan'), due_day: 5, bills_from: '2026-01-01', ...fields,
    }).expect(201)).body;
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
        expect(response.headers['x-cache-invalidate']).toBe(base(orgId));
        expect(response.body).toEqual({
          kind: 'debt',
          source_account: { id: loan.id, name: loan.name, type: 'debt' },
          bill: null,
          source_bill: null,
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

      it('stamps a provider payment with the provider\'s recurring bill, and a debt payment with none', async () => {
        const vivo = await provider(orgId);
        const loan = await debt(orgId);
        const recurring = repos.bills.rows.find((row) => row.providerAccountId === vivo.id && row.kind === 'recurring') as { id: number };

        await payBill(orgId, recurring.id, '2026-02-05', { status: 'skipped' }).expect(201);
        await pay(orgId, loan.id, '2026-02-10', { status: 'skipped' }).expect(201);
        await payBill(orgId, recurring.id, '2026-02-05', { status: 'skipped' }).expect(409);

        const rows = repos.billPayments.rows;
        expect(rows.find((row) => row.sourceAccountId === vivo.id)).toMatchObject({ billId: null, providerBillId: recurring.id });
        expect(rows.find((row) => row.sourceAccountId === loan.id)).toMatchObject({ billId: null, providerBillId: null });
        // Leave the shared calendar as found: no open or overdue occurrences of these accounts.
        await repos.accounts.delete({ id: vivo.id });
        await repos.accounts.delete({ id: loan.id });
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

        await payBill(orgId, billOf(fee.id), '2026-01-05', paid(checking.id, { paid_on: '2026-01-06', amount: '200.00' })).expect(201);

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

        await payBill(orgId, billOf(fee.id), '2026-01-05', paid(checking.id, { record_charge: false })).expect(201);

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
        expect(response.headers['x-cache-invalidate']).toBeUndefined();
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
          const response = await pay(orgId, id, date, { status: 'skipped' }).expect(404);
          expect(response.body).toEqual(NOT_FOUND_BODY);
          expect(response.headers['x-cache-invalidate']).toBeUndefined();
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
          bodies.push(withoutTimestamp(await payBill(orgId, billOf(fee.id), '2026-01-05', paid(id)).expect(422)));
        }
        bodies.forEach((body) => expect(body).toEqual(ACCOUNT_NOT_FOUND));

        const usd = await regular(orgId, { currency: 'USD' });
        const mismatch = await payBill(orgId, billOf(fee.id), '2026-01-05', paid(usd.id)).expect(422);
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
        await payBill(orgId, billOf(fee.id), '2026-01-05', paid(checking.id)).expect(201);
        const withdrawal = repos.transactions.rows.find((row) => row.accountId === checking.id)?.id as number;
        await send(app, 'delete', `${base(orgId)}/accounts/${checking.id}/transactions/${withdrawal}.json`, ALICE).expect(204);

        const response = await undoBill(orgId, billOf(fee.id), '2026-01-05').expect(204);

        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['x-cache-invalidate']).toBe(base(orgId));
        expect(repos.transactions.rows.filter((row) => row.accountId === fee.id).map(({ id }) => id)).toEqual([unrelated]);
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === fee.id)).toBe(false);
        expect(await calendarRow(orgId, fee.id)).toMatchObject({ status: 'overdue', payment: null });
      });

      it('deletes a charge already sent to the accountant', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        await payBill(orgId, billOf(fee.id), '2026-01-05', paid(checking.id)).expect(201);
        const charge = repos.transactions.rows.find((row) => row.accountId === fee.id && row.amount < 0n);
        if (charge) charge.sentToAccountantAt = new Date();

        await undoBill(orgId, billOf(fee.id), '2026-01-05').expect(204);

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

    describe('per provider bill', () => {
      it('pays and undoes a recurring bill, with the bill description in the ledger and source_bill in the answer', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        const [recurring] = recurringOf(fee.id);

        const response = await payBill(orgId, recurring.id, '2026-01-05', paid(checking.id, { paid_on: '2026-01-05' })).expect(201);

        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['x-cache-invalidate']).toBe(base(orgId));
        expect(response.body).toMatchObject({ kind: 'provider_bill', status: 'paid', source_bill: { id: recurring.id }, bill: null });
        expect(ledgerOf(fee.id)[0].description).toBe(`${recurring.description} — 2026-01-05`);
        expect(repos.billPayments.rows.find((row) => row.providerBillId === recurring.id)).toMatchObject({ billId: null, dueDate: '2026-01-05' });
        await payBill(orgId, recurring.id, '2026-01-05', { status: 'skipped' }).expect(409);
        await undoBill(orgId, recurring.id, '2026-01-05').expect(204);
        expect(repos.billPayments.rows.some((row) => row.providerBillId === recurring.id)).toBe(false);
        await repos.accounts.delete({ id: fee.id });
      });

      it('pays two recurring bills of one provider on the same date independently', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        const [first] = recurringOf(fee.id);
        const second = await addRecurring(orgId, fee.id);

        await payBill(orgId, first.id, '2026-01-05', paid(checking.id)).expect(201);
        await payBill(orgId, second.id, '2026-01-05', paid(checking.id)).expect(201);
        await payBill(orgId, second.id, '2026-01-05', { status: 'skipped' }).expect(409);
        await undoBill(orgId, first.id, '2026-01-05').expect(204);

        expect(repos.billPayments.rows.filter((row) => row.sourceAccountId === fee.id).map((row) => row.providerBillId)).toEqual([second.id]);
        await undoBill(orgId, second.id, '2026-01-05').expect(204);
        await repos.accounts.delete({ id: fee.id });
      });

      it('pays and undoes a one-off bill through either route, sharing one row', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId, { due_day: null });
        const bill = await createBill(orgId, fee.id, checking.id);

        await payBill(orgId, bill.id, '2026-01-20', paid(checking.id)).expect(201);
        await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, { status: 'skipped' }).expect(409);
        await send(app, 'delete', billPaymentPath(orgId, bill.id), ALICE).expect(204);
        await send(app, 'post', billPaymentPath(orgId, bill.id), ALICE, { status: 'skipped' }).expect(201);
        await payBill(orgId, bill.id, '2026-01-20', { status: 'skipped' }).expect(409);
        await undoBill(orgId, bill.id, '2026-01-21').expect(404);
        await undoBill(orgId, bill.id, '2026-01-20').expect(204);
        await repos.accounts.delete({ id: fee.id });
      });

      it('answers the uniform 404 for dates that are not an occurrence of the bill', async () => {
        const fee = await provider(orgId);
        const [recurring] = recurringOf(fee.id);
        const hidden = await addRecurring(orgId, fee.id, { show_in_calendar: false });
        const early = await addRecurring(orgId, fee.id, { bills_from: '2026-03-01' });

        for (const [id, date] of [[recurring.id, '2026-01-06'], [recurring.id, 'abc'], [recurring.id, '2026-02-31'], [hidden.id, '2026-01-05'], [early.id, '2026-02-05']] as const) {
          expect((await payBill(orgId, id, date, { status: 'skipped' }).expect(404)).body).toEqual(NOT_FOUND_BODY);
        }
        expect((await undoBill(orgId, recurring.id, 'abc').expect(404)).body).toEqual(NOT_FOUND_BODY);
        await repos.accounts.delete({ id: fee.id });
      });

      it('answers 404 for a debt id, an unknown id and a non-numeric id', async () => {
        const loan = await debt(orgId);

        for (const id of [loan.id, 999999, 'abc']) {
          expect((await payBill(orgId, id, '2026-01-10', { status: 'skipped' }).expect(404)).body).toEqual(NOT_FOUND_BODY);
          expect((await undoBill(orgId, id, '2026-01-10').expect(404)).body).toEqual(NOT_FOUND_BODY);
        }
        await repos.accounts.delete({ id: loan.id });
      });

      it('answers 400 for an invalid body after the occurrence check, and 422 for a bad paying account', async () => {
        const fee = await provider(orgId);
        const [recurring] = recurringOf(fee.id);

        await payBill(orgId, recurring.id, '2026-01-05', { status: 'skipped', amount: '1.00' }).expect(400);
        expect(withoutTimestamp(await payBill(orgId, recurring.id, '2026-01-05', paid(999999)).expect(422))).toEqual(ACCOUNT_NOT_FOUND);
        await repos.accounts.delete({ id: fee.id });
      });

      it('on an archived provider: POST answers 404, DELETE answers 404 for a skip and 409 for a payment', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        const [recurring] = recurringOf(fee.id);
        await payBill(orgId, recurring.id, '2026-01-05', paid(checking.id)).expect(201);
        await payBill(orgId, recurring.id, '2026-02-05', { status: 'skipped' }).expect(201);
        await archive(orgId, fee.id);

        await payBill(orgId, recurring.id, '2026-03-05', { status: 'skipped' }).expect(404);
        await undoBill(orgId, recurring.id, '2026-02-05').expect(404);
        expect((await undoBill(orgId, recurring.id, '2026-01-05').expect(409)).body.error.code).toBe('ACCOUNT_ARCHIVED');
        await unarchive(orgId, fee.id);
        await undoBill(orgId, recurring.id, '2026-02-05').expect(204);
        await undoBill(orgId, recurring.id, '2026-01-05').expect(204);
        await repos.accounts.delete({ id: fee.id });
      });

      it('undoes an off-schedule (drifted) payment', async () => {
        const fee = await provider(orgId);
        const [recurring] = recurringOf(fee.id);
        await payBill(orgId, recurring.id, '2026-01-05', { status: 'skipped' }).expect(201);
        await send(app, 'patch', `${base(orgId)}/provider-bills/${recurring.id}.json`, ALICE, { due_day: 15 }).expect(200);

        await undoBill(orgId, recurring.id, '2026-01-05').expect(204);
        await repos.accounts.delete({ id: fee.id });
      });

      it('answers the account-level occurrence routes and bill-payments.json with the foreign-account 404 for a provider', async () => {
        const fee = await provider(orgId);
        const foreign = (await debt(null, {}, {}, BOB)).id;
        const routes: Array<[string, (id: number) => ReturnType<typeof send>]> = [
          ['GET bill-payments.json', (id) => send(app, 'get', `${base(orgId)}/accounts/${id}/bill-payments.json`, ALICE)],
          ['POST payment.json', (id) => pay(orgId, id, '2026-01-05', { status: 'skipped' })],
          ['DELETE payment.json', (id) => undo(orgId, id, '2026-01-05')],
        ];

        for (const [, call] of routes) {
          const reference = await call(foreign).expect(404);
          const response = await call(fee.id).expect(404);

          expect(response.status).toBe(reference.status);
          expect(withoutTimestamp(response)).toEqual(withoutTimestamp(reference));
          expect(response.body).toEqual(NOT_FOUND_BODY);
        }
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === fee.id)).toBe(false);
        await repos.accounts.delete({ id: fee.id });
        await repos.accounts.delete({ id: foreign });
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
          source_bill: null,
          off_schedule: true,
        }]);
        expect(await calendarRow(orgId, loan.id)).toMatchObject({ nominal_date: '2026-01-15', payment: null });

        await patchDueDay(10);
        expect((await history(loan.id).expect(200)).body.payments[0].off_schedule).toBe(false);
        expect(await calendarRow(orgId, loan.id)).toMatchObject({ nominal_date: '2026-01-10', status: 'paid' });
      });

      it('lists a provider\'s recurring bill rows per bill, newest due date first, with no owner fields', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        const recurring = billOf(fee.id);
        await payBill(orgId, recurring, '2026-01-05', { status: 'skipped' }).expect(201);
        await payBill(orgId, recurring, '2026-02-05', paid(checking.id)).expect(201);

        const response = await send(app, 'get', `${base(orgId)}/provider-bills/${recurring}/bill-payments.json`, ALICE).expect(200);

        expect(response.body.payments.map((row: Body) => [row.due_date, row.status, row.bill, row.off_schedule])).toEqual([
          ['2026-02-05', 'paid', null, false],
          ['2026-01-05', 'skipped', null, false],
        ]);
        expect(response.body.pagination).toEqual({ page: 1, per_page: 50, total_pages: 1, total_count: 2 });
        expect(response.headers['x-cache-allow']).toBe('true');
        expect(response.headers['x-skip-cache']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(ownerKeysIn(response.body)).toEqual([]);
        expect((await history(fee.id).expect(404)).body).toEqual(NOT_FOUND_BODY);
      });

      it('lists one provider bill\'s history per bill, flags only that bill\'s drift, and survives an archived provider', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId);
        const [first] = recurringOf(fee.id);
        const second = await addRecurring(orgId, fee.id, { due_day: 15 });
        const path = (id: number | string, query = '') => `${base(orgId)}/provider-bills/${id}/bill-payments.json${query}`;
        await payBill(orgId, first.id, '2026-01-05', paid(checking.id)).expect(201);
        await payBill(orgId, second.id, '2026-01-15', { status: 'skipped' }).expect(201);
        await send(app, 'patch', `${base(orgId)}/provider-bills/${first.id}.json`, ALICE, { due_day: 6 }).expect(200);

        const firstRows = (await send(app, 'get', path(first.id), ALICE).expect(200)).body;
        const secondRows = (await send(app, 'get', path(second.id), ALICE).expect(200)).body;

        expect(firstRows.payments).toHaveLength(1);
        expect(firstRows.payments[0]).toMatchObject({ due_date: '2026-01-05', off_schedule: true, bill: null, source_bill: { id: first.id } });
        expect(secondRows.payments).toHaveLength(1);
        expect(secondRows.payments[0]).toMatchObject({ off_schedule: false, source_bill: { id: second.id } });
        expect(ownerKeysIn(firstRows)).toEqual([]);
        expect(JSON.stringify(firstRows)).not.toContain('notes');

        await archive(orgId, fee.id);
        expect((await send(app, 'get', path(first.id), ALICE).expect(200)).body.payments).toHaveLength(1);
        await unarchive(orgId, fee.id);
        await undoBill(orgId, first.id, '2026-01-05').expect(204);
        await undoBill(orgId, second.id, '2026-01-15').expect(204);
        await repos.accounts.delete({ id: fee.id });
      });

      it('lists a one-off bill\'s history, and answers the uniform 404 for foreign, debt and bad ids and 400 for a bad page', async () => {
        const checking = await regular(orgId);
        const fee = await provider(orgId, { due_day: null });
        const bill = await createBill(orgId, fee.id, checking.id);
        const loan = await debt(orgId);
        const path = (id: number | string, query = '') => `${base(orgId)}/provider-bills/${id}/bill-payments.json${query}`;
        await payBill(orgId, bill.id, '2026-01-20', { status: 'skipped' }).expect(201);

        const rows = (await send(app, 'get', path(bill.id), ALICE).expect(200)).body.payments;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ bill: { id: bill.id }, source_bill: { id: bill.id }, off_schedule: false });
        for (const id of [loan.id, 999999, 'abc']) {
          expect((await send(app, 'get', path(id), ALICE).expect(404)).body).toEqual(NOT_FOUND_BODY);
        }
        expect((await send(app, 'get', path(bill.id), BOB).expect(404)).body).toEqual(NOT_FOUND_BODY);
        await send(app, 'get', path(bill.id, '?page=0'), ALICE).expect(400);
        await undoBill(orgId, bill.id, '2026-01-20').expect(204);
        await repos.accounts.delete({ id: fee.id });
        await repos.accounts.delete({ id: loan.id });
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

    it.each(CASES)('answers the uniform 404 on all eight routes for %s', async (_label, user, admin, orgId, key) => {
      const ids = owned[key] ?? { debt: 999999, bill: 999999 };
      const responses = [
        await send(app, 'post', occurrencePath(orgId, ids.debt, '2026-01-10'), user, { status: 'skipped' }, admin),
        await send(app, 'delete', occurrencePath(orgId, ids.debt, '2026-01-10'), user, undefined, admin),
        await send(app, 'post', billPaymentPath(orgId, ids.bill), user, { status: 'skipped' }, admin),
        await send(app, 'delete', billPaymentPath(orgId, ids.bill), user, undefined, admin),
        await send(app, 'get', `${base(orgId)}/accounts/${ids.debt}/bill-payments.json`, user, undefined, admin),
        await send(app, 'post', perBillPath(orgId, ids.bill, '2026-01-20'), user, { status: 'skipped' }, admin),
        await send(app, 'delete', perBillPath(orgId, ids.bill, '2026-01-20'), user, undefined, admin),
        await send(app, 'get', `${base(orgId)}/provider-bills/${ids.bill}/bill-payments.json`, user, undefined, admin),
      ];

      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual(NOT_FOUND_BODY);
        expect(response.headers['x-cache-invalidate']).toBeUndefined();
      }
      const ownedDebts = Object.values(owned).map(({ debt: id }) => id);
      expect(repos.billPayments.rows.some((row) => ownedDebts.includes(row.sourceAccountId))).toBe(false);
    });

    it('invalidates only the acting organization\'s bank prefix', async () => {
      const response = await send(app, 'post', occurrencePath(ALICE_ORG, owned.aliceOrg.debt, '2026-01-10'), ALICE, { status: 'skipped' })
        .expect(201);
      const header = response.headers['x-cache-invalidate'];

      expect(header).toBe(`/orgs/${ALICE_ORG}/bank`);
      expect(header).not.toContain(`/orgs/${BOB_ORG}`);
      expect(header.split(', ')).not.toContain('/bank');
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
