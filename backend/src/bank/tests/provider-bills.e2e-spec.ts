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
import { NOT_FOUND_CASES, ownerKeysIn, type OwnerFixtures } from './support/owner-matrix.js';
import { BillPayment } from '../entities/bill-payment.entity.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

// `provider-bills` CRUD (docs/agents/specs/split-provider/api/provider-bills.md).

type Body = Record<string, unknown>;

const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];
const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;
const code = (response: { body: { error: { code: string } } }): string => response.body.error.code;

describe('provider-bills (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const provider = (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { type: 'provider_expense', name: uniqueName('Provider'), ...fields });
  const regular = (orgId: number | null, fields: Body = {}) => createAccount(app, ALICE, orgId, { name: uniqueName('Checking'), ...fields });
  const listPath = (orgId: number | null, accountId: number | string, query = '') =>
    `${base(orgId)}/accounts/${accountId}/provider-bills.json${query}`;
  const billPath = (orgId: number | null, id: number | string) => `${base(orgId)}/provider-bills/${id}.json`;
  const post = (orgId: number | null, accountId: number | string, body: Body, user = ALICE) =>
    send(app, 'post', listPath(orgId, accountId), user, body);
  const recurring = (description: string, fields: Body = {}): Body => ({ kind: 'recurring', description, due_day: 5, ...fields });
  const oneOff = (description: string, fields: Body = {}): Body =>
    ({ kind: 'one_off', description, due_date: '2026-03-10', expected_amount: '10.00', ...fields });
  const addPayment = (sourceAccountId: number, ids: { billId?: number; providerBillId?: number }, status: 'paid' | 'skipped', dueDate = '2026-03-10') =>
    repos.billPayments.save(Object.assign(new BillPayment(), {
      sourceAccountId,
      billId: null,
      providerBillId: null,
      ...ids,
      dueDate,
      status,
      paidOn: status === 'paid' ? dueDate : null,
      amount: status === 'paid' ? 1000n : null,
      payingAccountId: null,
      paymentTransactionId: null,
      withdrawalTransactionId: null,
      chargeTransactionId: null,
    }));
  const archive = (orgId: number | null, id: number) => send(app, 'post', `${base(orgId)}/accounts/${id}/archive.json`, ALICE).expect(200);

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    describe('create and show', () => {
      it('creates a recurring bill with the defaults and shows it', async () => {
        const fee = await provider(orgId);
        const created = await post(orgId, fee.id, recurring('  Rent  ')).expect(201);

        expect(created.body).toEqual({
          id: expect.any(Number),
          provider_account_id: fee.id,
          kind: 'recurring',
          description: 'Rent',
          paying_account_id: null,
          expected_amount: null,
          notes: null,
          charge_frequency: 'monthly',
          due_day: 5,
          due_month: null,
          bills_from: new Date().toISOString().slice(0, 10),
          show_in_calendar: true,
          due_date: null,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        });
        expect(created.headers['x-skip-cache']).toBe('true');
        expect(created.headers['x-cache-invalidate']).toBe(base(orgId));
        const shown = await send(app, 'get', billPath(orgId, created.body.id), ALICE).expect(200);
        expect(shown.body).toEqual(created.body);
        expect(shown.headers['x-cache-allow']).toBe('true');
        expect(ownerKeysIn(shown.body)).toEqual([]);
      });

      it('creates a yearly recurring bill and a one-off, formatting the amount', async () => {
        const fee = await provider(orgId);
        const yearly = await post(orgId, fee.id, recurring('Tax', { charge_frequency: 'yearly', due_month: 3, expected_amount: '99.9' })).expect(201);
        const single = await post(orgId, fee.id, oneOff('Fine', { notes: 'n' })).expect(201);

        expect(yearly.body).toMatchObject({ charge_frequency: 'yearly', due_month: 3, expected_amount: '99.90' });
        expect(single.body).toMatchObject({
          kind: 'one_off', due_date: '2026-03-10', expected_amount: '10.00', notes: 'n', charge_frequency: null, due_day: null, bills_from: null, show_in_calendar: null,
        });
      });

      it.each([
        ['a recurring bill without due_day', { kind: 'recurring', description: 'a' }],
        ['a recurring bill with due_date', recurring('a', { due_date: '2026-03-10' })],
        ['a yearly bill without due_month', recurring('a', { charge_frequency: 'yearly' })],
        ['a one-off without due_date', { kind: 'one_off', description: 'a', expected_amount: '1' }],
        ['a one-off without expected_amount', { kind: 'one_off', description: 'a', due_date: '2026-03-10' }],
        ['a one-off with a zero amount', oneOff('a', { expected_amount: '0' })],
        ['a one-off with due_day', oneOff('a', { due_day: 3 })],
        ['a one-off with charge_frequency', oneOff('a', { charge_frequency: 'monthly' })],
        ['an unknown kind', { kind: 'weekly', description: 'a' }],
        ['an id', recurring('a', { id: 9 })],
        ['an owner', recurring('a', { user_id: 9 })],
        ['created_at', recurring('a', { created_at: '2020-01-01' })],
      ])('answers 400 for %s', async (_label, body) => {
        const fee = await provider(orgId);

        await post(orgId, fee.id, body).expect(400);
      });

      it('answers 409 ACCOUNT_ARCHIVED under an archived provider, but lists it', async () => {
        const fee = await provider(orgId);
        await post(orgId, fee.id, recurring('Rent')).expect(201);
        await archive(orgId, fee.id);

        const rejected = await post(orgId, fee.id, recurring('Other')).expect(409);
        const listed = await send(app, 'get', listPath(orgId, fee.id), ALICE).expect(200);

        expect(code(rejected)).toBe('ACCOUNT_ARCHIVED');
        expect(listed.body.provider_bills).toHaveLength(1);
      });

      it('answers 422 for an unknown or other-currency paying account', async () => {
        const fee = await provider(orgId);
        const usd = await regular(orgId, { currency: 'USD' });

        expect(code(await post(orgId, fee.id, recurring('a', { paying_account_id: 999999 })).expect(422))).toBe('ACCOUNT_NOT_FOUND');
        expect(code(await post(orgId, fee.id, recurring('a', { paying_account_id: usd.id })).expect(422))).toBe('CURRENCY_MISMATCH');
      });

      it('accepts a paying account of the provider currency', async () => {
        const fee = await provider(orgId);
        const paying = await regular(orgId);
        const created = await post(orgId, fee.id, recurring('a', { paying_account_id: paying.id })).expect(201);

        expect(created.body.paying_account_id).toBe(paying.id);
      });
    });

    describe('list', () => {
      it('lists recurring bills by description, then one-offs by newest due date', async () => {
        const fee = await provider(orgId);
        const bills = [
          (await post(orgId, fee.id, oneOff('old', { due_date: '2026-01-01' })).expect(201)).body,
          (await post(orgId, fee.id, recurring('b')).expect(201)).body,
          (await post(orgId, fee.id, oneOff('new', { due_date: '2026-06-01' })).expect(201)).body,
          (await post(orgId, fee.id, recurring('a')).expect(201)).body,
        ];

        const all = await send(app, 'get', listPath(orgId, fee.id), ALICE).expect(200);
        const onlyRecurring = await send(app, 'get', listPath(orgId, fee.id, '?kind=recurring'), ALICE).expect(200);
        const onlyOneOff = await send(app, 'get', listPath(orgId, fee.id, '?kind=one_off'), ALICE).expect(200);
        const unknown = await send(app, 'get', listPath(orgId, fee.id, '?kind=nope'), ALICE).expect(200);

        expect(all.body.provider_bills.map((bill: Body) => bill.id)).toEqual([bills[3].id, bills[1].id, bills[2].id, bills[0].id]);
        expect(all.body.pagination).toEqual({ page: 1, per_page: 50, total_pages: 1, total_count: 4 });
        expect(all.headers['x-cache-allow']).toBe('true');
        expect(onlyRecurring.body.provider_bills).toHaveLength(2);
        expect(onlyOneOff.body.provider_bills).toHaveLength(2);
        expect(unknown.body.provider_bills).toEqual([]);
        expect(unknown.body.pagination.total_count).toBe(0);
      });

      it('paginates across both kinds, 50 per page', async () => {
        const fee = await provider(orgId);
        for (let i = 0; i < 3; i += 1) {
          await post(orgId, fee.id, recurring(`r${i}`)).expect(201);
        }
        for (let i = 0; i < 49; i += 1) {
          await post(orgId, fee.id, oneOff(`o${i}`, { due_date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` })).expect(201);
        }

        const first = await send(app, 'get', listPath(orgId, fee.id), ALICE).expect(200);
        const second = await send(app, 'get', listPath(orgId, fee.id, '?page=2'), ALICE).expect(200);
        const third = await send(app, 'get', listPath(orgId, fee.id, '?page=3'), ALICE).expect(200);

        expect(first.body.provider_bills).toHaveLength(50);
        expect(first.body.provider_bills.slice(0, 3).map((bill: Body) => bill.description)).toEqual(['r0', 'r1', 'r2']);
        expect(second.body.provider_bills).toHaveLength(2);
        expect(second.body.provider_bills.every((bill: Body) => bill.kind === 'one_off')).toBe(true);
        expect(third.body.provider_bills).toEqual([]);
        expect(first.body.pagination).toEqual({ page: 1, per_page: 50, total_pages: 2, total_count: 52 });
        await send(app, 'get', listPath(orgId, fee.id, '?page=0'), ALICE).expect(400);
        await send(app, 'get', listPath(orgId, fee.id, '?page=x'), ALICE).expect(400);
      });
    });

    describe('update', () => {
      it('edits a recurring bill, including the schedule with paid payments', async () => {
        const fee = await provider(orgId);
        const bill = (await post(orgId, fee.id, recurring('Rent')).expect(201)).body;
        await addPayment(fee.id, { providerBillId: bill.id }, 'paid');

        const patched = await send(app, 'patch', billPath(orgId, bill.id), ALICE, {
          description: ' Rent 2 ', due_day: 9, expected_amount: '5', notes: 'x', charge_frequency: 'yearly', due_month: 4, show_in_calendar: false,
        }).expect(200);

        expect(patched.body).toMatchObject({
          description: 'Rent 2', due_day: 9, expected_amount: '5.00', notes: 'x', charge_frequency: 'yearly', due_month: 4, show_in_calendar: false,
        });
        expect(patched.headers['x-skip-cache']).toBe('true');
        expect(patched.headers['x-cache-invalidate']).toBe(base(orgId));
        const cleared = await send(app, 'patch', billPath(orgId, bill.id), ALICE, { expected_amount: null, notes: null }).expect(200);
        expect(cleared.body).toMatchObject({ expected_amount: null, notes: null });
      });

      it('locks the provider row before the bill row on every recurring update, and only the bill for a one-off', async () => {
        const fee = await provider(orgId);
        const rec = (await post(orgId, fee.id, recurring('Rent')).expect(201)).body;
        const single = (await post(orgId, fee.id, oneOff('Fine')).expect(201)).body;
        const log: string[] = [];
        const accountFind = repos.accounts.findOne;
        const billFind = repos.bills.findOne;

        repos.accounts.findOne = (async (options: Parameters<typeof accountFind>[0]) => {
          if (options.lock) log.push('provider');
          return accountFind(options);
        }) as typeof accountFind;
        repos.bills.findOne = (async (options: Parameters<typeof billFind>[0]) => {
          if (options.lock) log.push('bill');
          return billFind(options);
        }) as typeof billFind;

        await send(app, 'patch', billPath(orgId, rec.id), ALICE, { notes: 'x' }).expect(200);
        expect(log).toEqual(['provider', 'bill']);

        log.length = 0;
        await send(app, 'patch', billPath(orgId, single.id), ALICE, { notes: 'x' }).expect(200);
        expect(log).toEqual(['bill']);
      });

      it('validates the merged state with 400', async () => {
        const fee = await provider(orgId);
        const rec = (await post(orgId, fee.id, recurring('Rent')).expect(201)).body;
        const single = (await post(orgId, fee.id, oneOff('Fine')).expect(201)).body;

        for (const [id, body] of [
          [rec.id, { charge_frequency: 'yearly' }],
          [rec.id, { due_date: '2026-01-01' }],
          [rec.id, { due_day: null }],
          [single.id, { due_day: 4 }],
          [single.id, { expected_amount: null }],
          [single.id, { expected_amount: '0' }],
          [single.id, { due_date: null }],
          [single.id, { id: 3 }],
        ] as Array<[number, Body]>) {
          await send(app, 'patch', billPath(orgId, id), ALICE, body).expect(400);
        }
      });

      it('answers 409 KIND_LOCKED for a different kind, and accepts the same one', async () => {
        const fee = await provider(orgId);
        const rec = (await post(orgId, fee.id, recurring('Rent')).expect(201)).body;

        expect(code(await send(app, 'patch', billPath(orgId, rec.id), ALICE, { kind: 'one_off' }).expect(409))).toBe('PROVIDER_BILL_KIND_LOCKED');
        await send(app, 'patch', billPath(orgId, rec.id), ALICE, { kind: 'recurring' }).expect(200);
      });

      it('answers 409 PROVIDER_LOCKED before resolving the target', async () => {
        const fee = await provider(orgId);
        const other = await provider(orgId);
        const bobs = await provider(null, {}, BOB);
        const rec = (await post(orgId, fee.id, recurring('Rent')).expect(201)).body;

        for (const target of [other.id, bobs.id, 999999]) {
          const response = await send(app, 'patch', billPath(orgId, rec.id), ALICE, { provider_account_id: target }).expect(409);
          expect(code(response)).toBe('PROVIDER_BILL_PROVIDER_LOCKED');
        }
        await send(app, 'patch', billPath(orgId, rec.id), ALICE, { provider_account_id: fee.id }).expect(200);
      });

      it('moves a one-off to another provider and its payment row follows', async () => {
        const fee = await provider(orgId);
        const target = await provider(orgId);
        const single = (await post(orgId, fee.id, oneOff('Fine')).expect(201)).body;
        const payment = await addPayment(fee.id, { billId: single.id }, 'skipped');

        const moved = await send(app, 'patch', billPath(orgId, single.id), ALICE, { provider_account_id: target.id, due_date: '2026-04-01' }).expect(200);

        expect(moved.body).toMatchObject({ provider_account_id: target.id, due_date: '2026-04-01' });
        expect(repos.billPayments.rows.find((row) => row.id === payment.id)).toMatchObject({ sourceAccountId: target.id, dueDate: '2026-04-01' });
      });

      it('applies the move rules to the target', async () => {
        const fee = await provider(orgId);
        const usd = await provider(orgId, { currency: 'USD' });
        const archived = await provider(orgId);
        const bobs = await provider(null, {}, BOB);
        const debt = await createAccount(app, ALICE, orgId, { type: 'debt', name: uniqueName('Loan') });
        const single = (await post(orgId, fee.id, oneOff('Fine')).expect(201)).body;
        await archive(orgId, archived.id);
        const move = (target: number) => send(app, 'patch', billPath(orgId, single.id), ALICE, { provider_account_id: target });

        expect(code(await move(usd.id).expect(422))).toBe('CURRENCY_MISMATCH');
        expect(code(await move(archived.id).expect(409))).toBe('ACCOUNT_ARCHIVED');
        for (const target of [999999, bobs.id, debt.id]) {
          expect(withoutTimestamp(await move(target).expect(404))).toEqual(withoutTimestamp({ body: NOT_FOUND_BODY } as never));
        }
      });

      it('refuses to move a paid one-off, but still edits it in place', async () => {
        const fee = await provider(orgId);
        const target = await provider(orgId);
        const single = (await post(orgId, fee.id, oneOff('Fine')).expect(201)).body;
        await addPayment(fee.id, { billId: single.id }, 'paid');

        const moved = await send(app, 'patch', billPath(orgId, single.id), ALICE, { provider_account_id: target.id }).expect(409);

        expect(code(moved)).toBe('PROVIDER_BILL_PAID');
        await send(app, 'patch', billPath(orgId, single.id), ALICE, { notes: 'ok' }).expect(200);
      });

      it('re-checks the paying account against the target when moving', async () => {
        const fee = await provider(orgId);
        const target = await provider(orgId);
        const paying = await regular(orgId);
        const single = (await post(orgId, fee.id, oneOff('Fine', { paying_account_id: paying.id })).expect(201)).body;

        await send(app, 'patch', billPath(orgId, single.id), ALICE, { provider_account_id: target.id }).expect(200);
        expect(code(await send(app, 'patch', billPath(orgId, single.id), ALICE, { paying_account_id: 999999 }).expect(422))).toBe('ACCOUNT_NOT_FOUND');
        await archive(orgId, paying.id);
        expect(code(await send(app, 'patch', billPath(orgId, single.id), ALICE, { provider_account_id: fee.id }).expect(422))).toBe('ACCOUNT_NOT_FOUND');
      });
    });

    describe('name and limit conflicts', () => {
      it('answers 409 NAME_TAKEN case- and accent-insensitively, on create and on rename', async () => {
        const fee = await provider(orgId);
        const other = await provider(orgId);
        await post(orgId, fee.id, recurring('Água')).expect(201);
        const second = (await post(orgId, fee.id, recurring('Luz')).expect(201)).body;

        expect(code(await post(orgId, fee.id, recurring(' agua ')).expect(409))).toBe('PROVIDER_BILL_NAME_TAKEN');
        expect(code(await send(app, 'patch', billPath(orgId, second.id), ALICE, { description: 'ÁGUA' }).expect(409))).toBe('PROVIDER_BILL_NAME_TAKEN');
        await send(app, 'patch', billPath(orgId, second.id), ALICE, { description: 'LUZ' }).expect(200);
        await post(orgId, other.id, recurring('agua')).expect(201);
      });

      it('lets one-offs repeat a description and share one with a recurring bill', async () => {
        const fee = await provider(orgId);
        await post(orgId, fee.id, recurring('Rent')).expect(201);
        await post(orgId, fee.id, oneOff('Rent')).expect(201);
        await post(orgId, fee.id, oneOff('Rent')).expect(201);
      });

      it('answers 409 PROVIDER_BILL_LIMIT on the 51st recurring bill, but still takes one-offs', async () => {
        const fee = await provider(orgId);
        for (let i = 0; i < 50; i += 1) {
          await post(orgId, fee.id, recurring(`bill ${i}`)).expect(201);
        }

        expect(code(await post(orgId, fee.id, recurring('one more')).expect(409))).toBe('PROVIDER_BILL_LIMIT');
        await post(orgId, fee.id, oneOff('fine')).expect(201);
      });

      it('maps a unique-key violation raised by the write to NAME_TAKEN', async () => {
        const fee = await provider(orgId);
        await post(orgId, fee.id, recurring('Rent')).expect(201);
        const original = repos.bills.rows.slice();
        const spy = jest.spyOn(repos.bills, 'find').mockResolvedValueOnce([]);

        expect(code(await post(orgId, fee.id, recurring('rent')).expect(409))).toBe('PROVIDER_BILL_NAME_TAKEN');
        spy.mockRestore();
        expect(repos.bills.rows).toHaveLength(original.length);
      });
    });

    describe('delete', () => {
      it('deletes a bill, cascading skipped payments, and answers 204', async () => {
        const fee = await provider(orgId);
        const rec = (await post(orgId, fee.id, recurring('Rent')).expect(201)).body;
        const single = (await post(orgId, fee.id, oneOff('Fine')).expect(201)).body;
        await addPayment(fee.id, { providerBillId: rec.id }, 'skipped');
        await addPayment(fee.id, { billId: single.id }, 'skipped');

        const deleted = await send(app, 'delete', billPath(orgId, rec.id), ALICE).expect(204);
        await send(app, 'delete', billPath(orgId, single.id), ALICE).expect(204);

        expect(deleted.headers['x-skip-cache']).toBe('true');
        expect(deleted.headers['x-cache-invalidate']).toBe(base(orgId));
        expect(repos.billPayments.rows.filter((row) => row.sourceAccountId === fee.id)).toEqual([]);
        await send(app, 'get', billPath(orgId, rec.id), ALICE).expect(404);
      });

      it('answers 409 PROVIDER_BILL_PAID for a bill with a paid payment, of either kind', async () => {
        const fee = await provider(orgId);
        const rec = (await post(orgId, fee.id, recurring('Rent')).expect(201)).body;
        const single = (await post(orgId, fee.id, oneOff('Fine')).expect(201)).body;
        await addPayment(fee.id, { providerBillId: rec.id }, 'skipped', '2026-02-05');
        await addPayment(fee.id, { providerBillId: rec.id }, 'paid', '2026-03-05');
        await addPayment(fee.id, { billId: single.id }, 'paid');

        expect(code(await send(app, 'delete', billPath(orgId, rec.id), ALICE).expect(409))).toBe('PROVIDER_BILL_PAID');
        expect(code(await send(app, 'delete', billPath(orgId, single.id), ALICE).expect(409))).toBe('PROVIDER_BILL_PAID');
        await send(app, 'get', billPath(orgId, rec.id), ALICE).expect(200);
      });
    });
  });

  describe('uniform 404', () => {
    let fixtures: OwnerFixtures;
    let bills: Record<keyof Omit<OwnerFixtures, 'transactions'>, number>;
    let providers: Record<keyof Omit<OwnerFixtures, 'transactions'>, number>;

    beforeAll(async () => {
      const make = async (user: string, orgId: number | null) => {
        const fee = await provider(orgId, {}, user);
        const created = await post(orgId, fee.id, oneOff('Fine'), user).expect(201);

        return { fee: fee.id, bill: created.body.id as number };
      };
      const [alicePersonal, aliceOrg, bobPersonal, bobOrg] = [
        await make(ALICE, null), await make(ALICE, ALICE_ORG), await make(BOB, null), await make(BOB, BOB_ORG),
      ];
      bills = { alicePersonal: alicePersonal.bill, aliceOrg: aliceOrg.bill, bobPersonal: bobPersonal.bill, bobOrg: bobOrg.bill };
      providers = { alicePersonal: alicePersonal.fee, aliceOrg: aliceOrg.fee, bobPersonal: bobPersonal.fee, bobOrg: bobOrg.fee };
      fixtures = { ...bills, transactions: {} } as unknown as OwnerFixtures;
    });

    it.each(NOT_FOUND_CASES)('answers the same 404 on every verb for $label', async ({ user, admin, orgId, accountId }) => {
      const id = accountId(fixtures);
      const providerId = accountId({ ...fixtures, ...providers } as OwnerFixtures);
      const responses = [
        await send(app, 'get', billPath(orgId, id), user, undefined, admin),
        await send(app, 'patch', billPath(orgId, id), user, { notes: 'x' }, admin),
        await send(app, 'delete', billPath(orgId, id), user, undefined, admin),
        await send(app, 'get', listPath(orgId, providerId), user, undefined, admin),
        await send(app, 'post', listPath(orgId, providerId), user, recurring('x'), admin),
      ];

      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(withoutTimestamp(response)).toEqual({ error: NOT_FOUND_BODY.error, statusCode: 404 });
      }
    });

    it('answers 404 for a debt and a regular account', async () => {
      const debt = await createAccount(app, ALICE, null, { type: 'debt', name: uniqueName('Loan') });
      const checking = await regular(null);

      await send(app, 'get', listPath(null, debt.id), ALICE).expect(404);
      await send(app, 'post', listPath(null, checking.id), ALICE, recurring('x')).expect(404);
    });

    it('reads an archived-provider bill but rejects writes on it', async () => {
      const fee = await provider(null);
      const bill = (await post(null, fee.id, oneOff('Fine')).expect(201)).body;
      await archive(null, fee.id);

      const read = await send(app, 'get', billPath(null, bill.id), ALICE).expect(200);

      expect(read.body).toEqual(bill);
      await send(app, 'patch', billPath(null, bill.id), ALICE, { notes: 'x' }).expect(404);
      await send(app, 'delete', billPath(null, bill.id), ALICE).expect(404);
    });
  });
});
