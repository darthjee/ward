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
import { createOwnerFixtures, NOT_FOUND_CASES, ownerKeysIn, type OwnerFixtures } from './support/owner-matrix.js';
import { BillPayment } from '../entities/bill-payment.entity.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

// One-off bill CRUD (bills.md, *One-off bills* and *Validation*, and the decisions of #56).

type Body = Record<string, unknown>;

const ACCOUNT_NOT_FOUND = { error: { code: 'ACCOUNT_NOT_FOUND', message: 'account not found' }, statusCode: 422 };
const CURRENCY_MISMATCH = { error: { code: 'CURRENCY_MISMATCH', message: 'currency mismatch' }, statusCode: 422 };
const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('one-off bills (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const provider = (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { type: 'provider_expense', name: uniqueName('Provider'), ...fields });
  const regular = (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { name: uniqueName('Checking'), ...fields });
  const post = (orgId: number | null, body: Body, user = ALICE) => send(app, 'post', `${base(orgId)}/bills.json`, user, body);
  const billPath = (orgId: number | null, id: number | string) => `${base(orgId)}/bills/${id}.json`;
  const setup = async (orgId: number | null) => {
    const fee = await provider(orgId);
    const paying = await regular(orgId);
    const body = {
      provider_account_id: fee.id,
      paying_account_id: paying.id,
      due_date: '2026-03-10',
      amount: '150.5',
      description: '  Car tax  ',
      notes: 'yearly',
    };
    return { fee, paying, body };
  };
  const createBill = async (orgId: number | null, fields: Body = {}) => {
    const { fee, paying, body } = await setup(orgId);
    const created = await post(orgId, { ...body, ...fields }).expect(201);
    return { fee, paying, bill: created.body };
  };
  const addPayment = (sourceAccountId: number, billId: number, status: 'paid' | 'skipped') =>
    repos.billPayments.save(Object.assign(new BillPayment(), {
      sourceAccountId,
      billId,
      dueDate: '2026-03-10',
      status,
      paidOn: status === 'paid' ? '2026-03-10' : null,
      amount: status === 'paid' ? 15050n : null,
      payingAccountId: null,
      paymentTransactionId: null,
      withdrawalTransactionId: null,
      chargeTransactionId: null,
    }));

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    describe('create and show', () => {
      it('creates a bill and answers the bill response, with no owner fields', async () => {
        const { fee, paying, bill } = await createBill(orgId);

        expect(bill).toEqual({
          id: expect.any(Number),
          provider_account: { id: fee.id, name: fee.name },
          paying_account: { id: paying.id, name: paying.name },
          due_date: '2026-03-10',
          amount: '150.50',
          currency: 'BRL',
          description: 'Car tax',
          notes: 'yearly',
          payment: null,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        });
        const shown = await send(app, 'get', billPath(orgId, bill.id), ALICE).expect(200);
        expect(shown.body).toEqual(bill);
        expect(ownerKeysIn([bill, shown.body])).toEqual([]);
        expect(shown.headers['x-skip-cache']).toBe('true');
      });

      it('accepts a past due date and amounts in the provider currency', async () => {
        const fee = await provider(orgId, { currency: 'JPY' });
        const paying = await regular(orgId, { currency: 'JPY' });

        const created = await post(orgId, {
          provider_account_id: fee.id,
          paying_account_id: paying.id,
          due_date: '2001-01-01',
          amount: '5000',
          description: 'Old fine',
        }).expect(201);

        expect(created.body).toMatchObject({ amount: '5000', currency: 'JPY', due_date: '2001-01-01', notes: null });
        await post(orgId, { provider_account_id: fee.id, paying_account_id: paying.id, due_date: '2001-01-01', amount: '1.5', description: 'x' })
          .expect(400);
      });

      it.each([
        ['a missing provider_account_id', { provider_account_id: undefined }],
        ['a missing paying_account_id', { paying_account_id: undefined }],
        ['an invalid due_date', { due_date: '2026-02-30' }],
        ['a zero amount', { amount: '0' }],
        ['a negative amount', { amount: '-1.00' }],
        ['too many decimals', { amount: '1.001' }],
        ['an amount over the bound', { amount: '100000000000.01' }],
        ['a blank description', { description: '   ' }],
        ['a description over 255 code points', { description: '😀'.repeat(256) }],
        ['notes over 2000 characters', { notes: 'a'.repeat(2001) }],
        ['an unknown field', { user_id: 1 }],
        ['a status field', { status: 'paid' }],
      ])('answers 400 for %s (never truncated)', async (_label, fields) => {
        const { body } = await setup(orgId);

        await post(orgId, { ...body, ...fields }).expect(400);
      });

      it('accepts a 255-code-point description and the amount bound itself', async () => {
        await createBill(orgId, { description: '😀'.repeat(255), amount: '100000000000.00' });
      });

      it('answers one generic 422 for every invalid provider_account_id or paying_account_id', async () => {
        const { fee, paying, body } = await setup(orgId);
        const otherContext = await provider(orgId === null ? ALICE_ORG : null);
        const otherContextPaying = await regular(orgId === null ? ALICE_ORG : null);
        const bobs = await provider(null, {}, BOB);
        const bobsPaying = await regular(null, {}, BOB);
        const archivedProvider = await provider(orgId);
        const archivedPaying = await regular(orgId);
        const debt = await createAccount(app, ALICE, orgId, { type: 'debt', name: uniqueName('Loan') });
        await send(app, 'post', `${base(orgId)}/accounts/${archivedProvider.id}/archive.json`, ALICE).expect(200);
        await send(app, 'post', `${base(orgId)}/accounts/${archivedPaying.id}/archive.json`, ALICE).expect(200);

        const bodies = [];
        for (const providerId of [999999, otherContext.id, bobs.id, paying.id, debt.id, archivedProvider.id]) {
          bodies.push(withoutTimestamp(await post(orgId, { ...body, provider_account_id: providerId }).expect(422)));
        }
        for (const payingId of [999999, otherContextPaying.id, bobsPaying.id, fee.id, debt.id, archivedPaying.id]) {
          bodies.push(withoutTimestamp(await post(orgId, { ...body, paying_account_id: payingId }).expect(422)));
        }

        bodies.forEach((response) => expect(response).toEqual(ACCOUNT_NOT_FOUND));
      });

      it('answers 422 currency mismatch for a paying account of another currency', async () => {
        const { body } = await setup(orgId);
        const usd = await regular(orgId, { currency: 'USD' });

        expect(withoutTimestamp(await post(orgId, { ...body, paying_account_id: usd.id }).expect(422))).toEqual(CURRENCY_MISMATCH);
      });
    });

    describe('list', () => {
      it('lists the owner\'s bills newest due date first, then newest id, with pagination', async () => {
        const { fee, paying } = await setup(orgId);
        const base_ = { provider_account_id: fee.id, paying_account_id: paying.id, amount: '1', description: 'x' };
        const older = (await post(orgId, { ...base_, due_date: '2026-01-01' }).expect(201)).body;
        const first = (await post(orgId, { ...base_, due_date: '2026-05-01' }).expect(201)).body;
        const second = (await post(orgId, { ...base_, due_date: '2026-05-01' }).expect(201)).body;

        const response = await send(app, 'get', `${base(orgId)}/bills.json?provider_account_id=${fee.id}`, ALICE).expect(200);

        expect(response.body.bills.map((row: Body) => row.id)).toEqual([second.id, first.id, older.id]);
        expect(response.body.pagination).toEqual({ page: 1, per_page: 50, total_pages: 1, total_count: 3 });
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(ownerKeysIn(response.body)).toEqual([]);
      });

      it('paginates 50 per page and answers 400 for an invalid page', async () => {
        const { fee, paying } = await setup(orgId);
        for (let i = 0; i < 51; i++) {
          await post(orgId, { provider_account_id: fee.id, paying_account_id: paying.id, due_date: '2026-01-01', amount: '1', description: `${i}` })
            .expect(201);
        }
        const path = `${base(orgId)}/bills.json?provider_account_id=${fee.id}`;

        const second = await send(app, 'get', `${path}&page=2`, ALICE).expect(200);

        expect(second.body.bills).toHaveLength(1);
        expect(second.body.pagination).toEqual({ page: 2, per_page: 50, total_pages: 2, total_count: 51 });
        await send(app, 'get', `${path}&page=0`, ALICE).expect(400);
        await send(app, 'get', `${path}&page=abc`, ALICE).expect(400);
      });

      it('answers an empty list (never 404) for an unknown, foreign or non-provider filter', async () => {
        const bobs = await provider(null, {}, BOB);
        const paying = await regular(orgId);

        for (const id of [999999, bobs.id, paying.id]) {
          const response = await send(app, 'get', `${base(orgId)}/bills.json?provider_account_id=${id}`, ALICE).expect(200);
          expect(response.body).toEqual({ bills: [], pagination: { page: 1, per_page: 50, total_pages: 1, total_count: 0 } });
        }
        await send(app, 'get', `${base(orgId)}/bills.json?provider_account_id=abc`, ALICE).expect(400);
      });
    });

    describe('update', () => {
      it('edits fields, clears the paying account and notes', async () => {
        const { bill } = await createBill(orgId);

        const response = await send(app, 'patch', billPath(orgId, bill.id), ALICE, {
          due_date: '2026-04-01',
          amount: '99.99',
          description: 'Renamed',
          notes: null,
          paying_account_id: null,
        }).expect(200);

        expect(response.body).toMatchObject({ due_date: '2026-04-01', amount: '99.99', description: 'Renamed', notes: null, paying_account: null });
      });

      it('re-checks the paying account currency when the provider changes', async () => {
        const { bill } = await createBill(orgId);
        const usdProvider = await provider(orgId, { currency: 'USD' });

        const response = await send(app, 'patch', billPath(orgId, bill.id), ALICE, { provider_account_id: usdProvider.id }).expect(422);

        expect(withoutTimestamp(response)).toEqual(CURRENCY_MISMATCH);
        const usdPaying = await regular(orgId, { currency: 'USD' });
        const moved = await send(app, 'patch', billPath(orgId, bill.id), ALICE, {
          provider_account_id: usdProvider.id,
          paying_account_id: usdPaying.id,
        }).expect(200);
        expect(moved.body).toMatchObject({ provider_account: { id: usdProvider.id }, currency: 'USD', amount: '150.50' });
      });

      it('answers 422 for a foreign provider or paying account, and 409 when a paid bill changes provider', async () => {
        const { fee, bill } = await createBill(orgId);
        const bobs = await provider(null, {}, BOB);
        await send(app, 'patch', billPath(orgId, bill.id), ALICE, { provider_account_id: bobs.id }).expect(422);
        await send(app, 'patch', billPath(orgId, bill.id), ALICE, { paying_account_id: 999999 }).expect(422);

        await addPayment(fee.id, bill.id, 'paid');
        const other = await provider(orgId);
        const response = await send(app, 'patch', billPath(orgId, bill.id), ALICE, { provider_account_id: other.id }).expect(409);
        expect(response.body.error.code).toBe('BILL_PAID');
        await send(app, 'patch', billPath(orgId, bill.id), ALICE, { description: 'Still editable' }).expect(200);
      });

      it('moves a skip along with the bill\'s provider and due date', async () => {
        const { fee, bill } = await createBill(orgId);
        await addPayment(fee.id, bill.id, 'skipped');
        const other = await provider(orgId);

        await send(app, 'patch', billPath(orgId, bill.id), ALICE, { provider_account_id: other.id, due_date: '2026-07-01' }).expect(200);

        expect(repos.billPayments.rows.find((row) => row.billId === bill.id)).toMatchObject({ sourceAccountId: other.id, dueDate: '2026-07-01' });
      });

      it('answers 400 for invalid or unknown fields', async () => {
        const { bill } = await createBill(orgId);

        await send(app, 'patch', billPath(orgId, bill.id), ALICE, { amount: '0' }).expect(400);
        await send(app, 'patch', billPath(orgId, bill.id), ALICE, { description: null }).expect(400);
        await send(app, 'patch', billPath(orgId, bill.id), ALICE, { organization_id: 3 }).expect(400);
      });
    });

    describe('delete', () => {
      it('hard-deletes an unpaid bill (204)', async () => {
        const { bill } = await createBill(orgId);

        const response = await send(app, 'delete', billPath(orgId, bill.id), ALICE).expect(204);

        expect(response.headers['cache-control']).toBe('no-store');
        await send(app, 'get', billPath(orgId, bill.id), ALICE).expect(404);
      });

      it('deletes a skipped bill together with its payment row', async () => {
        const { fee, bill } = await createBill(orgId);
        await addPayment(fee.id, bill.id, 'skipped');

        await send(app, 'delete', billPath(orgId, bill.id), ALICE).expect(204);

        expect(repos.billPayments.rows.some((row) => row.billId === bill.id)).toBe(false);
      });

      it('answers 409 for a paid bill and keeps it', async () => {
        const { fee, bill } = await createBill(orgId);
        await addPayment(fee.id, bill.id, 'paid');

        const response = await send(app, 'delete', billPath(orgId, bill.id), ALICE).expect(409);

        expect(response.body.error.code).toBe('BILL_PAID');
        const shown = await send(app, 'get', billPath(orgId, bill.id), ALICE).expect(200);
        expect(shown.body.payment).toMatchObject({ status: 'paid', amount: '150.50' });
      });
    });

    it('hides the bills of an archived provider (404, and absent from the list)', async () => {
      const { fee, bill } = await createBill(orgId);
      await send(app, 'post', `${base(orgId)}/accounts/${fee.id}/archive.json`, ALICE).expect(200);

      expect((await send(app, 'get', billPath(orgId, bill.id), ALICE).expect(404)).body).toEqual(NOT_FOUND_BODY);
      const list = await send(app, 'get', `${base(orgId)}/bills.json?provider_account_id=${fee.id}`, ALICE).expect(200);
      expect(list.body.bills).toEqual([]);
    });
  });

  describe('path ids', () => {
    let fixtures: OwnerFixtures;
    let bills: Record<'alicePersonal' | 'aliceOrg' | 'bobPersonal' | 'bobOrg', number>;

    beforeAll(async () => {
      fixtures = await createOwnerFixtures(app);
      const billOf = async (user: string, orgId: number | null) => {
        const fee = await provider(orgId, {}, user);
        const paying = await regular(orgId, {}, user);
        return (await post(orgId, { provider_account_id: fee.id, paying_account_id: paying.id, due_date: '2026-03-10', amount: '1', description: 'x' }, user)
          .expect(201)).body.id as number;
      };
      bills = {
        alicePersonal: await billOf(ALICE, null),
        aliceOrg: await billOf(ALICE, ALICE_ORG),
        bobPersonal: await billOf(BOB, null),
        bobOrg: await billOf(BOB, BOB_ORG),
      };
    });

    const ROUTES: Array<[string, 'get' | 'patch' | 'delete', Body?]> = [
      ['GET', 'get'],
      ['PATCH', 'patch', { description: 'x' }],
      ['DELETE', 'delete'],
    ];

    describe.each(ROUTES)('%s <base>/bills/:id.json', (_label, method, body) => {
      it.each(NOT_FOUND_CASES)('answers the uniform 404 for $label', async ({ user, admin, orgId, accountId }) => {
        const mapped = accountId({ ...fixtures, ...bills } as unknown as OwnerFixtures);
        const response = await send(app, method, billPath(orgId, mapped), user, body, admin).expect(404);

        expect(response.body).toEqual(NOT_FOUND_BODY);
      });
    });
  });
});
