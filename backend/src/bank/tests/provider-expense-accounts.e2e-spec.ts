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
import { BillPayment } from '../entities/bill-payment.entity.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { AccountBalancesQuery } from './support/in-memory-ledger.query.js';
import { ProviderBillsSummaryQuery } from './support/in-memory-provider-bills-summary.query.js';
import { NOT_FOUND_CASES, ownerKeysIn, type OwnerFixtures } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

// Provider-expense accounts (docs/agents/modules/bank/provider-expense.md,
// docs/agents/backend/routes/bank.md): the generic account routes with `type: provider_expense` and a nested
// `provider_expense` object, in both owner contexts.

type Method = 'get' | 'post' | 'patch' | 'delete';
type Body = Record<string, unknown>;

const DEFAULT_PROVIDER_EXPENSE = {
  for_accountant: true,
  provider_tax_id: null,
  expected_amount: null,
  charge_frequency: 'monthly',
  due_day: null,
  due_month: null,
  bills_from: null,
  show_in_calendar: true,
  paying_account: null,
};

const FULL_PROVIDER_EXPENSE = {
  for_accountant: false,
  provider_tax_id: '12.345.678/0001-90',
  expected_amount: '200.00',
  charge_frequency: 'yearly',
  due_day: 10,
  due_month: 3,
  bills_from: '2026-01-01',
  show_in_calendar: true,
};

const FULL_PROVIDER_EXPENSE_RESPONSE = { ...FULL_PROVIDER_EXPENSE, paying_account: null };

const MONTHLY_PROVIDER_EXPENSE = { ...FULL_PROVIDER_EXPENSE, charge_frequency: 'monthly', due_month: null };

const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];

const PROVIDER_ROUTES: Array<[string, Method, (prefix: string, id: number | string) => string, object?]> = [
  ['GET detail', 'get', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['PATCH provider_expense', 'patch', (prefix, id) => `${prefix}/accounts/${id}.json`, { provider_expense: { due_day: 5 } }],
  ['DELETE', 'delete', (prefix, id) => `${prefix}/accounts/${id}.json`],
  ['POST archive', 'post', (prefix, id) => `${prefix}/accounts/${id}/archive.json`],
  ['POST unarchive', 'post', (prefix, id) => `${prefix}/accounts/${id}/unarchive.json`],
  ['GET transactions', 'get', (prefix, id) => `${prefix}/accounts/${id}/transactions.json`],
  ['POST transaction', 'post', (prefix, id) => `${prefix}/accounts/${id}/transactions.json`, {
    date: '2026-01-02',
    amount: '-200.00',
    description: 'Charge',
  }],
];

// The issue's PATCH paired-rule table: stored state, PATCH object, expected status and fields.
// Every row has 5 entries (`null` = no merged fields to check): a shorter row would make Jest
// treat the callback's last parameter as `done`.
const PAIRED_RULE_TABLE: Array<[string, Body, Body, number, Body | null]> = [
  ['yearly, due_month 3', FULL_PROVIDER_EXPENSE, { due_day: 10 }, 200, { charge_frequency: 'yearly', due_month: 3 }],
  ['yearly, due_month 3', FULL_PROVIDER_EXPENSE, { due_month: 7 }, 200, { charge_frequency: 'yearly', due_month: 7 }],
  ['yearly, due_month 3', FULL_PROVIDER_EXPENSE, { due_month: null }, 400, null],
  ['yearly, due_month 3', FULL_PROVIDER_EXPENSE, { charge_frequency: 'monthly' }, 200, { charge_frequency: 'monthly', due_month: null }],
  ['yearly, due_month 3', FULL_PROVIDER_EXPENSE, { charge_frequency: 'monthly', due_month: 5 }, 400, null],
  ['monthly', MONTHLY_PROVIDER_EXPENSE, { due_month: 5 }, 400, null],
  ['monthly', MONTHLY_PROVIDER_EXPENSE, { charge_frequency: 'yearly' }, 400, null],
  ['monthly', MONTHLY_PROVIDER_EXPENSE, { charge_frequency: 'yearly', due_month: 5 }, 200, { charge_frequency: 'yearly', due_month: 5 }],
];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('provider-expense accounts (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const createProvider = (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { type: 'provider_expense', name: uniqueName('Accountant'), ...fields });
  const accountPath = (orgId: number | null, id: number) => `${base(orgId)}/accounts/${id}.json`;
  const patch = (orgId: number | null, id: number, body: Body) => send(app, 'patch', accountPath(orgId, id), ALICE, body);
  const detailsOf = (id: number) => repos.providerExpenseDetails.rows.find((row) => row.accountId === id);
  const addTransaction = (orgId: number | null, id: number, amount: string, description = 'Charge') =>
    send(app, 'post', `${base(orgId)}/accounts/${id}/transactions.json`, ALICE, { date: '2026-01-02', amount, description });

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const prefix = base(orgId);

    describe('recurring provider bill write-through', () => {
      const recurringOf = (id: number) => repos.bills.rows.filter((row) => row.providerAccountId === id && row.kind === 'recurring');

      describe('reading the schedule fields from the recurring bills', () => {
        const shown = async (id: number) => (await send(app, 'get', accountPath(orgId, id), ALICE).expect(200)).body.provider_expense;
        const billsPath = (id: number) => `${base(orgId)}/accounts/${id}/provider-bills.json`;

        it('reflects the single bill edited through provider-bills', async () => {
          const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
          const [bill] = recurringOf(created.id);

          await send(app, 'patch', `${base(orgId)}/provider-bills/${bill.id}.json`, ALICE, { due_day: 21, expected_amount: '12.34', show_in_calendar: false }).expect(200);

          expect(await shown(created.id)).toMatchObject({ due_day: 21, expected_amount: '12.34', show_in_calendar: false, for_accountant: false });
        });

        it('reads the details row when the provider has no recurring bill', async () => {
          const created = await createProvider(orgId, { provider_expense: { expected_amount: '45.00' } });

          expect(recurringOf(created.id)).toEqual([]);
          expect(await shown(created.id)).toMatchObject({ expected_amount: '45.00', due_day: null, show_in_calendar: true });
        });

        it('answers null for all seven schedule fields with two recurring bills', async () => {
          const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
          await send(app, 'post', billsPath(created.id), ALICE, { kind: 'recurring', description: 'Second', due_day: 9 }).expect(201);

          const nested = await shown(created.id);

          expect(nested).toMatchObject({
            expected_amount: null,
            charge_frequency: null,
            due_day: null,
            due_month: null,
            bills_from: null,
            show_in_calendar: null,
            paying_account: null,
          });
          expect(nested).toHaveProperty('for_accountant');
        });
      });

      it('creates one recurring bill with the copied fields on create with due_day, and none without it', async () => {
        const scheduled = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const unscheduled = await createProvider(orgId);

        expect(recurringOf(scheduled.id)).toEqual([
          expect.objectContaining({
            description: scheduled.name,
            expectedAmount: 20000n,
            chargeFrequency: 'yearly',
            dueDay: 10,
            dueMonth: 3,
            billsFrom: '2026-01-01',
            showInCalendar: true,
            payingAccountId: null,
            dueDate: null,
          }),
        ]);
        expect(recurringOf(unscheduled.id)).toEqual([]);
      });

      it('creates the bill when a PATCH first sets due_day, then updates the same bill', async () => {
        const created = await createProvider(orgId);

        await patch(orgId, created.id, { provider_expense: { due_day: 5 } }).expect(200);
        const [first] = recurringOf(created.id);
        await patch(orgId, created.id, { provider_expense: { due_day: 6, expected_amount: '10.00' } }).expect(200);

        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ id: first.id, dueDay: 6, expectedAmount: 1000n })]);
      });

      it('hides the bill (kept, last due_day, payments intact) when due_day is cleared, and reuses it when set again', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const [bill] = recurringOf(created.id);
        const payment = await repos.billPayments.save(Object.assign(new BillPayment(), {
          sourceAccountId: created.id,
          billId: null,
          providerBillId: bill.id,
          dueDate: '2026-03-10',
          status: 'skipped',
          paidOn: null,
          amount: null,
          payingAccountId: null,
          paymentTransactionId: null,
          withdrawalTransactionId: null,
          chargeTransactionId: null,
        }));

        const cleared = await patch(orgId, created.id, { provider_expense: { due_day: null, due_month: null, charge_frequency: 'monthly' } }).expect(200);
        expect(cleared.body.provider_expense).toMatchObject({ due_day: 10, show_in_calendar: false });
        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ id: bill.id, dueDay: 10, showInCalendar: false })]);
        expect(repos.billPayments.rows.some((row) => row.id === payment.id)).toBe(true);

        await patch(orgId, created.id, { provider_expense: { due_day: 12, show_in_calendar: true } }).expect(200);
        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ id: bill.id, dueDay: 12, showInCalendar: true })]);
      });

      it('keeps the description equal to the name when the provider is renamed, leaving the response unchanged', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const renamed = uniqueName('Renamed');

        const response = await patch(orgId, created.id, { name: renamed }).expect(200);

        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ description: renamed })]);
        expect(response.body.provider_expense).toEqual(FULL_PROVIDER_EXPENSE_RESPONSE);
      });

      const snapshot = (rows: object[]): string => JSON.stringify(rows, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
      const billsPath = (id: number) => `${prefix}/accounts/${id}/provider-bills.json`;
      const addRecurring = (id: number, description: string) =>
        send(app, 'post', billsPath(id), ALICE, { kind: 'recurring', description, due_day: 15 }).expect(201);

      it('does not write through on a PATCH without schedule field or rename, leaving /provider-bills edits alone', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const [bill] = recurringOf(created.id);
        await send(app, 'patch', `${prefix}/provider-bills/${bill.id}.json`, ALICE, { description: 'Custom', due_day: 20 }).expect(200);

        await patch(orgId, created.id, { notes: 'n', provider_expense: { for_accountant: true, provider_tax_id: '1' } }).expect(200);

        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ id: bill.id, description: 'Custom', dueDay: 20 })]);
      });

      it('lets a schedule-only PATCH keep a description edited through /provider-bills, and a rename overwrite it', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const [bill] = recurringOf(created.id);
        await send(app, 'patch', `${prefix}/provider-bills/${bill.id}.json`, ALICE, { description: 'Custom' }).expect(200);

        await patch(orgId, created.id, { provider_expense: { due_day: 11 } }).expect(200);
        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ description: 'Custom', dueDay: 11 })]);

        const renamed = uniqueName('Renamed');
        await patch(orgId, created.id, { name: renamed }).expect(200);
        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ description: renamed, dueDay: 11 })]);
      });

      it('re-creates a deleted only bill when due_day is set, but not on a name-only PATCH', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const [bill] = recurringOf(created.id);
        await send(app, 'delete', `${prefix}/provider-bills/${bill.id}.json`, ALICE).expect(204);

        await patch(orgId, created.id, { name: uniqueName('Renamed') }).expect(200);
        expect(recurringOf(created.id)).toEqual([]);

        await patch(orgId, created.id, { provider_expense: { due_day: 12 } }).expect(200);
        expect(recurringOf(created.id)).toEqual([expect.objectContaining({ dueDay: 12 })]);
      });

      it('answers 409 PROVIDER_HAS_MULTIPLE_BILLS for a schedule field with two recurring bills, writing nothing', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        await addRecurring(created.id, 'Second');
        const before = snapshot(recurringOf(created.id));

        for (const field of [
          { expected_amount: '1.00' }, { charge_frequency: 'monthly', due_month: null }, { due_day: 3 }, { due_month: 4 },
          { bills_from: '2026-02-01' }, { show_in_calendar: false }, { paying_account_id: null },
        ]) {
          const response = await patch(orgId, created.id, { provider_expense: field }).expect(409);
          expect(response.body.error.code).toBe('PROVIDER_HAS_MULTIPLE_BILLS');
        }
        expect(snapshot(recurringOf(created.id))).toBe(before);
        expect(detailsOf(created.id)).toMatchObject({ dueDay: 10 });
      });

      it('lets non-schedule fields through with several recurring bills, touching none of the bills', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        await addRecurring(created.id, 'Second');
        const before = snapshot(recurringOf(created.id));

        await patch(orgId, created.id, { name: uniqueName('Renamed'), notes: 'n' }).expect(200);
        await patch(orgId, created.id, { provider_expense: { for_accountant: true, provider_tax_id: '9' } }).expect(200);

        expect(snapshot(recurringOf(created.id))).toBe(before);
      });

      const addOneOff = (id: number, amount: string) =>
        send(app, 'post', billsPath(id), ALICE, { kind: 'one_off', description: 'Fine', due_date: '2026-05-05', expected_amount: amount }).expect(201);
      const amountsOf = (id: number) => repos.bills.rows.filter((row) => row.providerAccountId === id).map((row) => row.expectedAmount);

      it('rescales every bill (both kinds) on a currency change', async () => {
        const created = await createProvider(orgId, { provider_expense: { ...FULL_PROVIDER_EXPENSE, expected_amount: '200.00' } });
        await addOneOff(created.id, '50.00');

        await patch(orgId, created.id, { currency: 'JPY' }).expect(200);

        expect(amountsOf(created.id).sort()).toEqual([200n, 50n].sort());
        expect(detailsOf(created.id)?.expectedAmount).toBe(200n);
      });

      it('rejects an unrepresentable bill amount with 400 (the transaction rolls the rest back)', async () => {
        const created = await createProvider(orgId, { provider_expense: { ...FULL_PROVIDER_EXPENSE, expected_amount: '200.00' } });
        await addOneOff(created.id, '12.50');

        await patch(orgId, created.id, { currency: 'JPY' }).expect(400);

        expect(amountsOf(created.id)).toContain(1250n);
      });

      it('answers 422 when a bill\'s paying account does not fit the new currency', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const paying = await createAccount(app, ALICE, orgId, { name: uniqueName('Checking') });
        const [bill] = recurringOf(created.id);
        await send(app, 'patch', `${prefix}/provider-bills/${bill.id}.json`, ALICE, { paying_account_id: paying.id, expected_amount: '300.00' }).expect(200);

        const response = await patch(orgId, created.id, { currency: 'USD' }).expect(422);

        expect(response.body.error.code).toBe('CURRENCY_MISMATCH');
      });
    });

    describe('create', () => {
      it('creates a provider account without an object, with a defaults details row', async () => {
        const created = await createProvider(orgId);

        expect(created).toMatchObject({ type: 'provider_expense', balance: '0.00', provider_expense: DEFAULT_PROVIDER_EXPENSE });
        expect(detailsOf(created.id)).toMatchObject({
          forAccountant: true,
          providerTaxId: null,
          expectedAmount: null,
          dueDay: null,
          chargeFrequency: 'monthly',
          dueMonth: null,
        });

        const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body.provider_expense).toEqual(DEFAULT_PROVIDER_EXPENSE);
      });

      it('creates a provider account with a full object', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE, notes: 'Monthly fee' });

        expect(created.provider_expense).toEqual(FULL_PROVIDER_EXPENSE_RESPONSE);
        expect(created.notes).toBe('Monthly fee');
        expect(detailsOf(created.id)).toMatchObject({ forAccountant: false, expectedAmount: 20000n, dueMonth: 3 });
      });

      it('trims the tax id and stores a blank one as null', async () => {
        const trimmed = await createProvider(orgId, { provider_expense: { provider_tax_id: '  123.456  ' } });
        const blank = await createProvider(orgId, { provider_expense: { provider_tax_id: '   ' } });

        expect(trimmed.provider_expense.provider_tax_id).toBe('123.456');
        expect(blank.provider_expense.provider_tax_id).toBeNull();
      });

      it('formats the expected amount in the account currency exponent', async () => {
        const created = await createProvider(orgId, { currency: 'JPY', provider_expense: { expected_amount: '200' } });

        expect(created.provider_expense.expected_amount).toBe('200');
        expect(detailsOf(created.id)?.expectedAmount).toBe(200n);
      });

      it.each(['0.00', '150.00', '-80.00'])('accepts the opening balance %p', async (opening) => {
        const created = await createProvider(orgId, { opening_balance: opening });

        expect(created.opening_balance).toBe(opening);
      });
    });

    describe('responses', () => {
      it('carries the provider_expense object on list rows, detail, create, PATCH, archive and unarchive', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });
        const responses = [
          await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200),
          await patch(orgId, created.id, { notes: 'n' }).expect(200),
          await send(app, 'post', `${prefix}/accounts/${created.id}/archive.json`, ALICE).expect(200),
          await send(app, 'post', `${prefix}/accounts/${created.id}/unarchive.json`, ALICE).expect(200),
        ];
        const list = await send(app, 'get', `${prefix}/accounts.json?type=provider_expense`, ALICE).expect(200);

        responses.forEach((response) => expect(response.body.provider_expense).toEqual(FULL_PROVIDER_EXPENSE_RESPONSE));
        expect(list.body.find((row: { id: number }) => row.id === created.id).provider_expense).toEqual(FULL_PROVIDER_EXPENSE_RESPONSE);
        expect(ownerKeysIn([created, list.body, ...responses.map((response) => response.body)])).toEqual([]);
        expect(created).not.toHaveProperty('debt');
        expect(created).not.toHaveProperty('investment');
      });

      it('never carries a provider_expense object on regular, debt and investment accounts', async () => {
        const others = [
          await createAccount(app, ALICE, orgId),
          await createAccount(app, ALICE, orgId, { type: 'debt' }),
          await createAccount(app, ALICE, orgId, { type: 'investment' }),
        ];
        const details = await Promise.all(others.map((other) => send(app, 'get', accountPath(orgId, other.id), ALICE).expect(200)));

        [...others, ...details.map((response) => response.body)].forEach((body) =>
          expect(body).not.toHaveProperty('provider_expense'));
      });
    });

    describe('validation', () => {
      it.each([
        ['yearly without due_month', { charge_frequency: 'yearly' }],
        ['due_month with the default monthly', { due_month: 3 }],
        ['due_month with an explicit monthly', { charge_frequency: 'monthly', due_month: 3 }],
        ['due_day 0', { due_day: 0 }],
        ['due_day 32', { due_day: 32 }],
        ['due_month 0', { charge_frequency: 'yearly', due_month: 0 }],
        ['due_month 13', { charge_frequency: 'yearly', due_month: 13 }],
        ['a zero expected_amount', { expected_amount: '0' }],
        ['a negative expected_amount', { expected_amount: '-10.00' }],
        ['an expected_amount over the bound', { expected_amount: '100000000000.01' }],
        ['an expected_amount with too many decimals', { expected_amount: '1.001' }],
        ['a malformed expected_amount', { expected_amount: 'abc' }],
        ['a numeric expected_amount', { expected_amount: 200 }],
        ['a 33-character provider_tax_id', { provider_tax_id: 'x'.repeat(33) }],
        ['a null charge_frequency', { charge_frequency: null }],
        ['an unknown charge_frequency', { charge_frequency: 'weekly' }],
        ['a null for_accountant', { for_accountant: null }],
        ['a string for_accountant', { for_accountant: 'yes' }],
        ['an unknown field inside provider_expense', { color: 'red' }],
        ['sent_to_accountant_at (out of scope)', { sent_to_accountant_at: '2026-01-01T00:00:00Z' }],
      ])('rejects %s with a 400 on create and PATCH', async (_label, providerExpense) => {
        const before = repos.accounts.rows.length;
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'provider_expense',
          name: uniqueName('Bad'),
          provider_expense: providerExpense,
        }).expect(400);
        expect(repos.accounts.rows.length).toBe(before);

        const created = await createProvider(orgId);
        await patch(orgId, created.id, { provider_expense: providerExpense }).expect(400);
        expect(detailsOf(created.id)).toMatchObject({ forAccountant: true, chargeFrequency: 'monthly', dueMonth: null });
      });

      it('accepts a 32-character tax id and the amount bound', async () => {
        const created = await createProvider(orgId, {
          provider_expense: { provider_tax_id: 'x'.repeat(32), expected_amount: '100000000000.00' },
        });

        expect(created.provider_expense).toMatchObject({ provider_tax_id: 'x'.repeat(32), expected_amount: '100000000000.00' });
      });

      it('rejects a null provider_expense object', async () => {
        await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
          type: 'provider_expense',
          name: uniqueName('Bad'),
          provider_expense: null,
        }).expect(400);

        const created = await createProvider(orgId);
        await patch(orgId, created.id, { provider_expense: null }).expect(400);
      });

      it('rejects a provider_expense object on regular, debt and investment accounts, on create and PATCH', async () => {
        for (const type of ['regular', 'debt', 'investment']) {
          await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
            type,
            name: uniqueName('Other'),
            provider_expense: {},
          }).expect(400);

          const other = await createAccount(app, ALICE, orgId, { type });
          await patch(orgId, other.id, { provider_expense: { due_day: 1 } }).expect(400);
        }
      });

      it('rejects a debt or investment object on a provider account, on create and PATCH', async () => {
        const created = await createProvider(orgId);

        for (const foreign of [{ debt: { due_day: 1 } }, { investment: { kind: 'fund' } }]) {
          await send(app, 'post', `${prefix}/accounts.json`, ALICE, {
            type: 'provider_expense',
            name: uniqueName('Provider'),
            ...foreign,
          }).expect(400);
          await patch(orgId, created.id, foreign).expect(400);
        }
      });
    });

    describe('PATCH', () => {
      it('merges the object partially and clears optional fields sent as null', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });

        const merged = await patch(orgId, created.id, { provider_expense: { due_day: 20, for_accountant: true } }).expect(200);
        expect(merged.body.provider_expense).toEqual({ ...FULL_PROVIDER_EXPENSE_RESPONSE, due_day: 20, for_accountant: true });

        const cleared = await patch(orgId, created.id, {
          provider_expense: { provider_tax_id: null, expected_amount: null, due_day: null },
        }).expect(200);
        expect(cleared.body.provider_expense).toEqual({
          ...FULL_PROVIDER_EXPENSE_RESPONSE,
          for_accountant: true,
          provider_tax_id: null,
          // The schedule fields now come from the single recurring bill, which clearing `due_day` only hides.
          expected_amount: '200.00',
          due_day: 20,
          show_in_calendar: false,
        });
      });

      it.each(PAIRED_RULE_TABLE)('stored %s + %#: answers the expected status', async (_stored, stored, body, status, expected) => {
        const created = await createProvider(orgId, { provider_expense: stored });

        const response = await patch(orgId, created.id, { provider_expense: body }).expect(status);

        if (expected) {
          expect(response.body.provider_expense).toMatchObject(expected);
        } else {
          const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
          expect(detail.body.provider_expense).toEqual({ ...stored, paying_account: null });
        }
      });

      it('rejects a type change', async () => {
        const created = await createProvider(orgId);

        await patch(orgId, created.id, { type: 'regular' }).expect(400);
        await patch(orgId, created.id, { type: 'provider_expense' }).expect(400);
      });

      it('rescales the expected amount on a currency change before any transaction', async () => {
        const created = await createProvider(orgId, { provider_expense: { expected_amount: '200.00' } });

        const changed = await patch(orgId, created.id, { currency: 'JPY' }).expect(200);

        expect(changed.body).toMatchObject({ currency: 'JPY', provider_expense: { expected_amount: '200' } });
        expect(detailsOf(created.id)?.expectedAmount).toBe(200n);
      });

      it('rejects a currency that cannot represent the expected amount (12.50 BRL to JPY)', async () => {
        const created = await createProvider(orgId, { provider_expense: { expected_amount: '12.50' } });

        await patch(orgId, created.id, { currency: 'JPY' }).expect(400);

        const detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body).toMatchObject({ currency: 'BRL', provider_expense: { expected_amount: '12.50' } });
      });

      it('validates an expected amount sent with a currency change against the new currency', async () => {
        const created = await createProvider(orgId, { provider_expense: { expected_amount: '12.50' } });

        await patch(orgId, created.id, { currency: 'JPY', provider_expense: { expected_amount: '12.5' } }).expect(400);
        const replaced = await patch(orgId, created.id, { currency: 'JPY', provider_expense: { expected_amount: '13' } })
          .expect(200);
        expect(replaced.body).toMatchObject({ currency: 'JPY', provider_expense: { expected_amount: '13' } });

        const other = await createProvider(orgId, { provider_expense: { expected_amount: '12.50' } });
        const cleared = await patch(orgId, other.id, { currency: 'JPY', provider_expense: { expected_amount: null } }).expect(200);
        expect(cleared.body).toMatchObject({ currency: 'JPY', provider_expense: { expected_amount: null } });
      });

      it('locks the currency once the provider account has transactions', async () => {
        const created = await createProvider(orgId, { opening_date: '2026-01-01' });
        await addTransaction(orgId, created.id, '-200.00').expect(201);

        const locked = await patch(orgId, created.id, { currency: 'JPY' }).expect(409);
        expect(locked.body.error.code).toBe('CURRENCY_LOCKED');
      });
    });

    describe('ledger', () => {
      it('records charges (negative) and payments (positive) through the generic transaction routes', async () => {
        const created = await createProvider(orgId, { opening_date: '2026-01-01', provider_expense: { expected_amount: '200.00' } });

        await addTransaction(orgId, created.id, '-210.37').expect(201);
        let detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body.balance).toBe('-210.37');

        await addTransaction(orgId, created.id, '300.00', 'Payment').expect(201);
        detail = await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(200);
        expect(detail.body.balance).toBe('89.63');

        const transactions = await send(app, 'get', `${prefix}/accounts/${created.id}/transactions.json`, ALICE).expect(200);
        expect(JSON.stringify(transactions.body)).toContain('-210.37');
      });
    });

    describe('archived provider account', () => {
      it('accepts only a rename; any provider_expense field answers 409 (format errors stay 400)', async () => {
        const created = await createProvider(orgId, { opening_date: '2026-01-01', provider_expense: FULL_PROVIDER_EXPENSE });
        await send(app, 'post', `${prefix}/accounts/${created.id}/archive.json`, ALICE).expect(200);

        const renamed = await patch(orgId, created.id, { name: uniqueName('Old accountant') }).expect(200);
        expect(renamed.body.provider_expense).toEqual(FULL_PROVIDER_EXPENSE_RESPONSE);

        for (const body of [
          { provider_expense: { due_day: 5 } },
          { provider_expense: { due_month: null } },
          { provider_expense: {} },
        ]) {
          const response = await patch(orgId, created.id, body).expect(409);
          expect(response.body.error.code).toBe('ACCOUNT_ARCHIVED');
        }

        await patch(orgId, created.id, { provider_expense: { due_day: 0 } }).expect(400);

        const write = await addTransaction(orgId, created.id, '-10.00').expect(409);
        expect(write.body.error.code).toBe('ACCOUNT_ARCHIVED');
        expect(detailsOf(created.id)?.dueDay).toBe(10);
      });
    });

    describe('delete', () => {
      it('deletes a provider account without transactions together with its details row', async () => {
        const created = await createProvider(orgId, { provider_expense: FULL_PROVIDER_EXPENSE });

        await send(app, 'delete', accountPath(orgId, created.id), ALICE).expect(204);

        expect(detailsOf(created.id)).toBeUndefined();
        await send(app, 'get', accountPath(orgId, created.id), ALICE).expect(404);
      });

      it('answers 409 for a provider account with transactions and keeps its details', async () => {
        const created = await createProvider(orgId, { opening_date: '2026-01-01' });
        await addTransaction(orgId, created.id, '-10.00').expect(201);

        const response = await send(app, 'delete', accountPath(orgId, created.id), ALICE).expect(409);

        expect(response.body.error.code).toBe('ACCOUNT_HAS_TRANSACTIONS');
        expect(detailsOf(created.id)).toBeDefined();
      });
    });

    describe('name uniqueness across types', () => {
      it('clashes with an active regular account of the same owner ("Vivo")', async () => {
        const name = uniqueName('Vivo');
        await createAccount(app, ALICE, orgId, { name });

        const create = await send(app, 'post', `${prefix}/accounts.json`, ALICE, { type: 'provider_expense', name: name.toUpperCase() });
        expect(create.status).toBe(409);
        expect(create.body.error.code).toBe('ACCOUNT_NAME_TAKEN');

        const provider = await createProvider(orgId);
        const rename = await patch(orgId, provider.id, { name: name.toLowerCase() }).expect(409);
        expect(rename.body.error.code).toBe('ACCOUNT_NAME_TAKEN');
      });
    });

    describe('list', () => {
      it('lists only provider accounts, which never appear under the other types', async () => {
        const tag = uniqueName('List');
        const zed = await createProvider(orgId, { name: `${tag} zed` });
        const alpha = await createProvider(orgId, { name: `${tag} Alpha` });
        const archived = await createProvider(orgId, { name: `${tag} middle` });
        const regular = await createAccount(app, ALICE, orgId, { name: `${tag} regular` });
        const debt = await createAccount(app, ALICE, orgId, { type: 'debt', name: `${tag} debt` });
        const investment = await createAccount(app, ALICE, orgId, { type: 'investment', name: `${tag} investment` });
        await send(app, 'post', `${prefix}/accounts/${archived.id}/archive.json`, ALICE).expect(200);

        const ids = async (query: string): Promise<number[]> => {
          const response = await send(app, 'get', `${prefix}/accounts.json${query}`, ALICE).expect(200);
          return response.body
            .filter((row: { name: string }) => row.name.startsWith(tag))
            .map((row: { id: number }) => row.id);
        };

        expect(await ids('?type=provider_expense')).toEqual([alpha.id, zed.id]);
        expect(await ids('?type=provider_expense&archived=true')).toEqual([alpha.id, archived.id, zed.id]);
        expect(await ids('')).toEqual([regular.id]);
        expect(await ids('?type=regular')).toEqual([regular.id]);
        expect(await ids('?type=debt')).toEqual([debt.id]);
        expect(await ids('?type=investment')).toEqual([investment.id]);
      });

      it('loads balances and details with one batch each (no N+1)', async () => {
        await createProvider(orgId);
        await createProvider(orgId);
        const balancesBefore = AccountBalancesQuery.groupedCalls;
        const detailsBefore = repos.providerExpenseDetails.findCalls;
        const billsBefore = (repos.bills as unknown as { findCalls: number }).findCalls;

        const response = await send(app, 'get', `${prefix}/accounts.json?type=provider_expense&archived=true`, ALICE).expect(200);

        expect(response.body.length).toBeGreaterThan(2);
        expect(AccountBalancesQuery.groupedCalls - balancesBefore).toBe(1);
        expect(repos.providerExpenseDetails.findCalls - detailsBefore).toBe(1);
        expect((repos.bills as unknown as { findCalls: number }).findCalls - billsBefore).toBe(1);
      });
    });

    describe('bills_summary', () => {
      const ZERO_SUMMARY = { count: 0, monthly: '0.00', yearly: '0.00' };
      const billsPath = (id: number) => `${prefix}/accounts/${id}/provider-bills.json`;
      const billPath = (id: number) => `${prefix}/provider-bills/${id}.json`;
      const addBill = async (providerId: number, body: Body): Promise<{ id: number }> =>
        (await send(app, 'post', billsPath(providerId), ALICE, body).expect(201)).body;
      const listed = async (query = '?type=provider_expense'): Promise<Array<Record<string, unknown> & { id: number }>> =>
        (await send(app, 'get', `${prefix}/accounts.json${query}`, ALICE).expect(200)).body;
      const summaryOf = async (id: number, query?: string): Promise<unknown> =>
        (await listed(query)).find((row) => row.id === id)?.bills_summary;

      it('counts every bill and sums only the recurring bills with amounts, per frequency', async () => {
        const created = await createProvider(orgId);
        await addBill(created.id, { kind: 'recurring', description: 'Fee', due_day: 5, expected_amount: '100.00' });
        await addBill(created.id, { kind: 'recurring', description: 'Support', due_day: 6, expected_amount: '150.00' });
        await addBill(created.id, { kind: 'recurring', description: 'Variable', due_day: 7 });
        await addBill(created.id, { kind: 'recurring', description: 'Tax', due_day: 8, charge_frequency: 'yearly', due_month: 3, expected_amount: '1200.00' });
        await addBill(created.id, { kind: 'one_off', description: 'Setup', due_date: '2026-03-10', expected_amount: '10.00' });

        expect(await summaryOf(created.id)).toEqual({ count: 5, monthly: '250.00', yearly: '1200.00' });
      });

      it('gives a provider without bills zeros, never null', async () => {
        const created = await createProvider(orgId);

        expect(await summaryOf(created.id)).toEqual(ZERO_SUMMARY);
      });

      it('formats the sums in the provider currency', async () => {
        const created = await createProvider(orgId, { currency: 'JPY' });
        await addBill(created.id, { kind: 'recurring', description: 'Fee', due_day: 5, expected_amount: '500' });

        expect(await summaryOf(created.id)).toEqual({ count: 1, monthly: '500', yearly: '0' });
      });

      it('carries it on archived providers in archived=true lists', async () => {
        const created = await createProvider(orgId);
        await addBill(created.id, { kind: 'one_off', description: 'Setup', due_date: '2026-03-10', expected_amount: '10.00' });
        await send(app, 'post', `${prefix}/accounts/${created.id}/archive.json`, ALICE).expect(200);

        expect(await summaryOf(created.id, '?type=provider_expense&archived=true')).toEqual({ count: 1, monthly: '0.00', yearly: '0.00' });
      });

      it('is absent from other types and from the single-account GET', async () => {
        const provider = await createProvider(orgId);
        await createAccount(app, ALICE, orgId, { name: uniqueName('Regular') });
        await createAccount(app, ALICE, orgId, { type: 'debt', name: uniqueName('Debt') });
        await createAccount(app, ALICE, orgId, { type: 'investment', name: uniqueName('Investment') });

        for (const type of ['regular', 'debt', 'investment']) {
          (await listed(`?type=${type}`)).forEach((row) => expect(row).not.toHaveProperty('bills_summary'));
        }

        expect((await send(app, 'get', accountPath(orgId, provider.id), ALICE).expect(200)).body).not.toHaveProperty('bills_summary');
      });

      it('runs one grouped query per list request (no N+1) and exposes no owner ids', async () => {
        await createProvider(orgId);
        await createProvider(orgId);
        const before = ProviderBillsSummaryQuery.groupedCalls;

        const rows = await listed('?type=provider_expense&archived=true');

        expect(rows.length).toBeGreaterThan(2);
        expect(ProviderBillsSummaryQuery.groupedCalls - before).toBe(1);
        expect(ownerKeysIn(rows.map((row) => row.bills_summary))).toEqual([]);
      });

      it('is refreshed after provider-bill writes, which invalidate the bank subtree including accounts.json', async () => {
        const created = await createProvider(orgId);
        const listPath = `${prefix}/accounts.json`;

        const posted = await send(app, 'post', billsPath(created.id), ALICE, { kind: 'recurring', description: 'Fee', due_day: 5, expected_amount: '100.00' }).expect(201);
        expect(posted.headers['x-cache-invalidate']).toBe(prefix);
        expect(listPath.startsWith(`${posted.headers['x-cache-invalidate']}/`)).toBe(true);
        expect(await summaryOf(created.id)).toEqual({ count: 1, monthly: '100.00', yearly: '0.00' });

        const patched = await send(app, 'patch', billPath(posted.body.id), ALICE, { expected_amount: '80.00' }).expect(200);
        expect(patched.headers['x-cache-invalidate']).toBe(prefix);
        expect(await summaryOf(created.id)).toEqual({ count: 1, monthly: '80.00', yearly: '0.00' });

        const deleted = await send(app, 'delete', billPath(posted.body.id), ALICE).expect(204);
        expect(deleted.headers['x-cache-invalidate']).toBe(prefix);
        expect(await summaryOf(created.id)).toEqual(ZERO_SUMMARY);
      });
    });
  });

  describe('uniform 404', () => {
    let fixtures: OwnerFixtures;
    let reference: object;

    beforeAll(async () => {
      fixtures = {
        alicePersonal: (await createProvider(null)).id,
        aliceOrg: (await createProvider(ALICE_ORG)).id,
        bobPersonal: (await createProvider(null, {}, BOB)).id,
        bobOrg: (await createProvider(BOB_ORG, {}, BOB)).id,
      } as OwnerFixtures;
      reference = withoutTimestamp(await send(app, 'get', '/bank/accounts/999999.json', ALICE).expect(404));
    });

    it('has the standard not-found body', () => {
      expect(reference).toEqual({ error: NOT_FOUND_BODY.error, statusCode: 404 });
    });

    describe.each(PROVIDER_ROUTES)('%s', (_route, method, path, body) => {
      it.each(NOT_FOUND_CASES.map((matrixCase) => [matrixCase.label, matrixCase]))(
        'answers the identical 404 for %s',
        async (_label, { user, admin, orgId, accountId }) => {
          const response = await send(app, method, path(base(orgId), accountId(fixtures)), user, body, admin);

          expect(response.status).toBe(404);
          expect(withoutTimestamp(response)).toEqual(reference);
        },
      );
    });

    it('answers the identical 404 on the provider list and create for a non-member :orgId', async () => {
      const list = await send(app, 'get', `/orgs/${BOB_ORG}/bank/accounts.json?type=provider_expense`, ALICE).expect(404);
      const create = await send(app, 'post', `/orgs/${BOB_ORG}/bank/accounts.json`, ALICE, { type: 'provider_expense', name: 'x' })
        .expect(404);

      [list, create].forEach((response) => expect(withoutTimestamp(response)).toEqual(reference));
    });

    it('changed nothing', () => {
      [fixtures.alicePersonal, fixtures.aliceOrg, fixtures.bobPersonal, fixtures.bobOrg].forEach((id) => {
        expect(repos.accounts.rows.find((row) => row.id === id)?.archivedAt).toBeNull();
        expect(detailsOf(id)?.dueDay).toBeNull();
        expect(repos.transactions.rows.some((row) => row.accountId === id)).toBe(false);
      });
    });
  });

  describe('caching', () => {
    it('sends X-Cache-Allow and the user-scoped Cache-Control on GETs', async () => {
      const created = await createProvider(null);

      for (const path of ['/bank/accounts.json?type=provider_expense', `/bank/accounts/${created.id}.json`]) {
        const response = await send(app, 'get', path, ALICE).expect(200);
        expect(response.headers['x-cache-allow']).toBe('true');
        expect(response.headers['x-skip-cache']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store');
      }
    });

    it('marks writes as never', async () => {
      const created = await send(app, 'post', '/bank/accounts.json', ALICE, { type: 'provider_expense', name: uniqueName('Cache') })
        .expect(201);
      const patched = await patch(null, created.body.id, { provider_expense: { due_day: 3 } }).expect(200);

      [created, patched].forEach((response) => {
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });
  });
});
