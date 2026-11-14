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
} from './support/build-bank-test-app.js';
import { AccountantChargesQuery } from './support/in-memory-accountant-charges.query.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { ownerKeysIn } from './support/owner-matrix.js';
import { Transaction } from '../entities/transaction.entity.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../accountant-charges.query.js', () => jest.requireActual('./support/in-memory-accountant-charges.query.js'));

// The accountant hand-off (docs/agents/modules/bank/provider-expense.md and
// docs/agents/backend/routes/bank.md, plus the decisions of #71), in both
// owner contexts. The real SQL is covered by `accountant-charges.integration-spec.ts`.

type Body = Record<string, unknown>;

const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;
const OCTOBER = 'from=2026-10-01&to=2026-10-31';

const VALIDATION_FAILED = { code: 'VALIDATION_FAILED', message: expect.any(String) };

describe('accountant hand-off (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const createProvider = async (orgId: number | null, fields: Body = {}, user = ALICE): Promise<number> =>
    (await createAccount(app, user, orgId, {
      type: 'provider_expense',
      name: uniqueName('Vivo'),
      bank_name: 'Vivo',
      opening_date: '2026-01-01',
      ...fields,
    })).id;
  const transactionsPath = (orgId: number | null, accountId: number) => `${base(orgId)}/accounts/${accountId}/transactions.json`;
  const addTransaction = async (
    orgId: number | null,
    accountId: number,
    amount: string,
    date = '2026-10-05',
    user = ALICE,
  ): Promise<number> =>
    (await send(app, 'post', transactionsPath(orgId, accountId), user, { date, amount, description: 'Charge' }).expect(201)).body.id;
  const preview = (orgId: number | null, query: string, user = ALICE) =>
    send(app, 'get', `${base(orgId)}/accountant/charges.json?${query}`, user);
  const mark = (orgId: number | null, action: 'sent' | 'unsent', body: object, user = ALICE) =>
    send(app, 'post', `${base(orgId)}/accountant/mark-${action}.json`, user, body);
  const previewIds = async (orgId: number | null, query = OCTOBER): Promise<number[]> =>
    (await preview(orgId, query).expect(200)).body.charges.map((row: { id: number }) => row.id);
  const sentAtOf = (id: number) => repos.transactions.rows.find((row) => row.id === id)?.sentToAccountantAt ?? null;
  const setSentAt = (id: number, sentAt: Date | null) => {
    (repos.transactions.rows.find((row) => row.id === id) as Transaction).sentToAccountantAt = sentAt;
  };
  const setForAccountant = (accountId: number, value: boolean) => {
    const details = repos.providerExpenseDetails.rows.find((row) => row.accountId === accountId);
    if (details) details.forAccountant = value;
  };
  const snapshotMarks = () => repos.transactions.rows.map((row) => [row.id, row.sentToAccountantAt]);

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  beforeEach(() => {
    repos.transactions.rows.splice(0);
    repos.providerExpenseDetails.rows.splice(0);
    repos.debtDetails.rows.splice(0);
    repos.investmentDetails.rows.splice(0);
    repos.accounts.rows.splice(0);
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const otherContext = orgId === null ? ALICE_ORG : null;

    describe('preview', () => {
      it('returns only the charges of the owner\'s for_accountant provider accounts, ordered by date then id', async () => {
        const flagged = await createProvider(orgId);
        const archived = await createProvider(orgId);
        const unflagged = await createProvider(orgId, { provider_expense: { for_accountant: false } });
        const regular = (await createAccount(app, ALICE, orgId, { opening_date: '2026-01-01' })).id;

        const late = await addTransaction(orgId, flagged, '-30.00', '2026-10-20');
        const first = await addTransaction(orgId, flagged, '-10.00', '2026-10-05');
        const second = await addTransaction(orgId, archived, '-20.00', '2026-10-05');
        await addTransaction(orgId, flagged, '50.00', '2026-10-06');
        await addTransaction(orgId, unflagged, '-40.00', '2026-10-07');
        await addTransaction(orgId, regular, '-50.00', '2026-10-08');
        await addTransaction(orgId, flagged, '-60.00', '2026-11-01');
        await addTransaction(orgId, flagged, '-70.00', '2026-09-30');
        await addTransaction(otherContext, await createProvider(otherContext), '-80.00', '2026-10-09');
        await addTransaction(null, await createProvider(null, {}, BOB), '-90.00', '2026-10-09', BOB);
        await addTransaction(BOB_ORG, await createProvider(BOB_ORG, {}, BOB), '-95.00', '2026-10-09', BOB);
        await send(app, 'post', `${base(orgId)}/accounts/${archived}/archive.json`, ALICE).expect(200);

        expect(await previewIds(orgId)).toEqual([first, second, late]);
      });

      it('includes charges dated before the account\'s opening_date', async () => {
        const account = await createProvider(orgId, { opening_date: '2026-10-20' });
        const early = await addTransaction(orgId, account, '-10.00', '2026-10-02');

        expect(await previewIds(orgId)).toEqual([early]);
      });

      it('answers the envelope with the nested five-field account and no owner fields', async () => {
        const account = await createProvider(orgId, {
          name: 'Vivo Fibra',
          account_number: '12345-6',
          provider_expense: { provider_tax_id: '02.558.157/0001-62' },
        });
        const id = await addTransaction(orgId, account, '-129.90');

        const response = await preview(orgId, OCTOBER).expect(200);

        expect(response.body).toEqual({
          charges: [{
            id,
            date: '2026-10-05',
            description: 'Charge',
            amount: '-129.90',
            sent_to_accountant_at: null,
            account: { id: account, name: 'Vivo Fibra', bank_name: 'Vivo', provider_tax_id: '02.558.157/0001-62', currency: 'BRL' },
          }],
        });
        expect(ownerKeysIn(response.body)).toEqual([]);
      });

      it('carries each row\'s own currency (mixed currencies)', async () => {
        const brl = await createProvider(orgId);
        const jpy = await createProvider(orgId, { currency: 'JPY' });
        await addTransaction(orgId, brl, '-10.50', '2026-10-01');
        await addTransaction(orgId, jpy, '-500', '2026-10-02');

        const { body } = await preview(orgId, OCTOBER).expect(200);

        expect(body.charges.map((row: Body) => [row.amount, (row.account as Body).currency])).toEqual([
          ['-10.50', 'BRL'],
          ['-500', 'JPY'],
        ]);
      });

      it('hides sent charges by default and shows them with include_sent=true', async () => {
        const account = await createProvider(orgId);
        const sent = await addTransaction(orgId, account, '-10.00', '2026-10-01');
        const unsent = await addTransaction(orgId, account, '-20.00', '2026-10-02');
        await mark(orgId, 'sent', { transaction_ids: [sent] }).expect(200);

        expect(await previewIds(orgId)).toEqual([unsent]);
        expect(await previewIds(orgId, `${OCTOBER}&include_sent=false`)).toEqual([unsent]);
        const { body } = await preview(orgId, `${OCTOBER}&include_sent=true`).expect(200);
        expect(body.charges.map((row: Body) => row.id)).toEqual([sent, unsent]);
        expect(body.charges[0].sent_to_accountant_at).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
      });

      it('answers an empty list for an empty range', async () => {
        await createProvider(orgId);

        await expect(preview(orgId, OCTOBER).expect(200)).resolves.toMatchObject({ body: { charges: [] } });
      });

      it.each([
        ['a single day (from == to)', 'from=2026-10-05&to=2026-10-05'],
        ['exactly 366 days', 'from=2025-01-01&to=2026-01-02'],
        ['to = UTC today + 1 day', `from=${isoDay(-1)}&to=${isoDay(1)}`],
        ['an unknown parameter (ignored)', `${OCTOBER}&color=red`],
      ])('accepts %s', async (_label, query) => {
        await preview(orgId, query).expect(200);
      });

      it.each([
        ['a missing from', 'to=2026-10-31'],
        ['a missing to', 'from=2026-10-01'],
        ['a malformed from', 'from=10/01/2026&to=2026-10-31'],
        ['an impossible to', 'from=2026-02-01&to=2026-02-30'],
        ['a future date', `from=${isoDay(-1)}&to=${isoDay(2)}`],
        ['from after to', 'from=2026-10-02&to=2026-10-01'],
        ['a range over 366 days (367)', 'from=2025-01-01&to=2026-01-03'],
        ['include_sent=1', `${OCTOBER}&include_sent=1`],
        ['include_sent=yes', `${OCTOBER}&include_sent=yes`],
        ['a repeated from', `${OCTOBER}&from=2026-10-02`],
        ['a repeated include_sent', `${OCTOBER}&include_sent=true&include_sent=false`],
      ])('answers 400 VALIDATION_FAILED on %s', async (_label, query) => {
        const response = await preview(orgId, query).expect(400);

        expect(response.body.error).toMatchObject(VALIDATION_FAILED);
      });

      it('answers 400 above 1000 charges ("narrow the range"), and accepts exactly 1000', async () => {
        const account = await createProvider(orgId);
        const pushCharges = (count: number) => {
          for (let i = 0; i < count; i++) {
            const row = repos.transactions.create({ accountId: account, date: '2026-10-05', amount: -1n, description: 'Bulk', notes: null });
            row.id = 100000 + repos.transactions.rows.length;
            repos.transactions.rows.push(row);
          }
        };
        pushCharges(1000);
        await preview(orgId, OCTOBER).expect(200);

        pushCharges(1);
        const response = await preview(orgId, OCTOBER).expect(400);

        expect(response.body.error).toEqual({ code: 'VALIDATION_FAILED', message: expect.stringContaining('narrow the range') });
      });

      it('sends X-Cache-Allow and the user-scoped Cache-Control', async () => {
        const response = await preview(orgId, OCTOBER).expect(200);

        expect(response.headers['x-cache-allow']).toBe('true');
        expect(response.headers['x-skip-cache']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store');
      });
    });

    describe('mark sent / unsent', () => {
      it('stamps exactly the posted ids, de-duplicated, and replies with their marks', async () => {
        const account = await createProvider(orgId);
        const a = await addTransaction(orgId, account, '-10.00', '2026-10-01');
        const b = await addTransaction(orgId, account, '-20.00', '2026-10-02');
        const untouched = await addTransaction(orgId, account, '-30.00', '2026-10-03');

        const response = await mark(orgId, 'sent', { transaction_ids: [b, a, b] }).expect(200);

        expect(response.headers['x-cache-invalidate']).toBe(base(orgId));
        expect(response.body).toEqual({
          charges: [
            { id: b, sent_to_accountant_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
            { id: a, sent_to_accountant_at: response.body.charges[0].sent_to_accountant_at },
          ],
        });
        expect(sentAtOf(a)).toBeInstanceOf(Date);
        expect(sentAtOf(untouched)).toBeNull();
        expect(await previewIds(orgId)).toEqual([untouched]);
      });

      it('is idempotent: a re-mark keeps the original timestamp', async () => {
        const account = await createProvider(orgId);
        const id = await addTransaction(orgId, account, '-10.00');
        const original = new Date('2026-10-10T10:00:00Z');
        setSentAt(id, original);

        const response = await mark(orgId, 'sent', { transaction_ids: [id] }).expect(200);

        expect(response.body).toEqual({ charges: [{ id, sent_to_accountant_at: original.toISOString() }] });
        expect(sentAtOf(id)).toEqual(original);
      });

      it('mark-unsent clears the mark, and the charge reappears in an unsent-only preview', async () => {
        const account = await createProvider(orgId);
        const sent = await addTransaction(orgId, account, '-10.00');
        const unsent = await addTransaction(orgId, account, '-20.00');
        setSentAt(sent, new Date('2026-10-10T10:00:00Z'));

        const response = await mark(orgId, 'unsent', { transaction_ids: [sent, unsent, sent] }).expect(200);

        expect(response.body).toEqual({
          charges: [
            { id: sent, sent_to_accountant_at: null },
            { id: unsent, sent_to_accountant_at: null },
          ],
        });
        expect(sentAtOf(sent)).toBeNull();
        expect(await previewIds(orgId)).toEqual([sent, unsent]);
      });

      it('for_accountant turned off keeps the marks, drops the account from the preview, and still allows mark-unsent', async () => {
        const account = await createProvider(orgId);
        const id = await addTransaction(orgId, account, '-10.00');
        await mark(orgId, 'sent', { transaction_ids: [id] }).expect(200);
        const stamped = sentAtOf(id);
        setForAccountant(account, false);

        expect(sentAtOf(id)).toEqual(stamped);
        expect(await previewIds(orgId, `${OCTOBER}&include_sent=true`)).toEqual([]);
        const rejected = await mark(orgId, 'sent', { transaction_ids: [id] }).expect(400);
        expect(rejected.body.error).toEqual({ code: 'VALIDATION_FAILED', message: `transaction ${id} is not a hand-off charge` });

        await mark(orgId, 'unsent', { transaction_ids: [id] }).expect(200);
        expect(sentAtOf(id)).toBeNull();

        setForAccountant(account, true);
        expect(await previewIds(orgId)).toEqual([id]);
      });

      it.each(['sent', 'unsent'] as const)('mark-%s answers 404 for another owner\'s or the other context\'s id, writing nothing', async (action) => {
        const account = await createProvider(orgId);
        const own = await addTransaction(orgId, account, '-10.00');
        const otherContextId = await addTransaction(otherContext, await createProvider(otherContext), '-10.00');
        const bobId = await addTransaction(null, await createProvider(null, {}, BOB), '-10.00', '2026-10-05', BOB);
        const before = snapshotMarks();

        for (const foreign of [otherContextId, bobId, 999999]) {
          const response = await mark(orgId, action, { transaction_ids: [own, foreign] }).expect(404);
          expect(response.body).toEqual(NOT_FOUND_BODY);
        }
        expect(snapshotMarks()).toEqual(before);
      });

      it('answers 404 (not 400) when a request mixes a foreign id and a payment', async () => {
        const account = await createProvider(orgId);
        const payment = await addTransaction(orgId, account, '10.00');
        const bobId = await addTransaction(null, await createProvider(null, {}, BOB), '-10.00', '2026-10-05', BOB);

        await mark(orgId, 'sent', { transaction_ids: [payment, bobId] }).expect(404);
        await mark(orgId, 'unsent', { transaction_ids: [payment, bobId] }).expect(404);
      });

      it('answers 404 on a non-member :orgId', async () => {
        await mark(BOB_ORG, 'sent', { transaction_ids: [1] }).expect(404);
        await preview(BOB_ORG, OCTOBER).expect(404);
      });

      it('mark-sent answers 400 naming payments, unflagged and other-type charges, writing nothing', async () => {
        const provider = await createProvider(orgId);
        const unflagged = await createProvider(orgId, { provider_expense: { for_accountant: false } });
        const regular = (await createAccount(app, ALICE, orgId, { opening_date: '2026-01-01' })).id;
        const debt = (await createAccount(app, ALICE, orgId, { type: 'debt', opening_date: '2026-01-01' })).id;
        const charge = await addTransaction(orgId, provider, '-10.00');
        const payment = await addTransaction(orgId, provider, '10.00');
        const unflaggedCharge = await addTransaction(orgId, unflagged, '-10.00');
        const regularCharge = await addTransaction(orgId, regular, '-10.00');
        const debtCharge = await addTransaction(orgId, debt, '-10.00');
        const before = snapshotMarks();

        const response = await mark(orgId, 'sent', {
          transaction_ids: [charge, debtCharge, payment, unflaggedCharge, regularCharge],
        }).expect(400);

        const rejected = [payment, unflaggedCharge, regularCharge, debtCharge].sort((x, y) => x - y);
        expect(response.body.error).toEqual({
          code: 'VALIDATION_FAILED',
          message: `transactions ${rejected.join(', ')} are not hand-off charges`,
        });
        expect(snapshotMarks()).toEqual(before);
      });

      it('mark-unsent answers 400 for a payment or another account type, writing nothing', async () => {
        const provider = await createProvider(orgId);
        const regular = (await createAccount(app, ALICE, orgId, { opening_date: '2026-01-01' })).id;
        const charge = await addTransaction(orgId, provider, '-10.00');
        const payment = await addTransaction(orgId, provider, '10.00');
        const regularCharge = await addTransaction(orgId, regular, '-10.00');
        setSentAt(charge, new Date('2026-10-10T10:00:00Z'));
        const before = snapshotMarks();

        for (const rejected of [payment, regularCharge]) {
          const response = await mark(orgId, 'unsent', { transaction_ids: [charge, rejected] }).expect(400);
          expect(response.body.error).toEqual({ code: 'VALIDATION_FAILED', message: `transaction ${rejected} is not a hand-off charge` });
        }
        expect(snapshotMarks()).toEqual(before);
      });

      it.each([
        ['an empty list', { transaction_ids: [] }],
        ['more than 1000 ids', { transaction_ids: Array.from({ length: 1001 }, (_v, i) => i + 1) }],
        ['a non-integer id', { transaction_ids: [1.5] }],
        ['a string id', { transaction_ids: ['7'] }],
        ['a zero id', { transaction_ids: [0] }],
        ['a missing list', {}],
        ['an extra body field', { transaction_ids: [1], sent_to_accountant_at: '2026-10-10T10:00:00Z' }],
      ])('answers 400 VALIDATION_FAILED on %s', async (_label, body) => {
        for (const action of ['sent', 'unsent'] as const) {
          const response = await mark(orgId, action, body).expect(400);
          expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
        }
      });

      it('is allowed on an archived account, while transaction create / edit / delete stay 409', async () => {
        const account = await createProvider(orgId);
        const id = await addTransaction(orgId, account, '-10.00');
        await send(app, 'post', `${base(orgId)}/accounts/${account}/archive.json`, ALICE).expect(200);

        await mark(orgId, 'sent', { transaction_ids: [id] }).expect(200);
        expect(sentAtOf(id)).toBeInstanceOf(Date);
        await mark(orgId, 'unsent', { transaction_ids: [id] }).expect(200);
        expect(sentAtOf(id)).toBeNull();

        const itemPath = `${base(orgId)}/accounts/${account}/transactions/${id}.json`;
        await send(app, 'post', transactionsPath(orgId, account), ALICE, { date: '2026-10-05', amount: '-1.00', description: 'x' }).expect(409);
        await send(app, 'patch', itemPath, ALICE, { description: 'x' }).expect(409);
        await send(app, 'delete', itemPath, ALICE).expect(409);
      });

      it('resolves every posted id in one query', async () => {
        const account = await createProvider(orgId);
        const ids = [await addTransaction(orgId, account, '-1.00'), await addTransaction(orgId, account, '-2.00')];
        AccountantChargesQuery.resolveCalls = 0;

        await mark(orgId, 'sent', { transaction_ids: ids }).expect(200);

        expect(AccountantChargesQuery.resolveCalls).toBe(1);
      });

      it('marks both routes as never', async () => {
        const account = await createProvider(orgId);
        const id = await addTransaction(orgId, account, '-1.00');

        for (const action of ['sent', 'unsent'] as const) {
          const response = await mark(orgId, action, { transaction_ids: [id] }).expect(200);
          expect(response.headers['x-skip-cache']).toBe('true');
          expect(response.headers['cache-control']).toBe('no-store');
        }
      });
    });

    describe('transactions', () => {
      it('carries sent_to_accountant_at only on provider charges (ledger, POST, PATCH)', async () => {
        const provider = await createProvider(orgId, { opening_balance: '0.00' });
        const regular = (await createAccount(app, ALICE, orgId, { opening_date: '2026-01-01' })).id;

        const charge = await send(app, 'post', transactionsPath(orgId, provider), ALICE, { date: '2026-10-05', amount: '-10.00', description: 'Charge' }).expect(201);
        const payment = await send(app, 'post', transactionsPath(orgId, provider), ALICE, { date: '2026-10-06', amount: '10.00', description: 'Payment' }).expect(201);
        const regularCharge = await send(app, 'post', transactionsPath(orgId, regular), ALICE, { date: '2026-10-05', amount: '-10.00', description: 'Coffee' }).expect(201);

        expect(charge.body).toHaveProperty('sent_to_accountant_at', null);
        expect(payment.body).not.toHaveProperty('sent_to_accountant_at');
        expect(regularCharge.body).not.toHaveProperty('sent_to_accountant_at');

        await mark(orgId, 'sent', { transaction_ids: [charge.body.id] }).expect(200);
        const patched = await send(app, 'patch', `${base(orgId)}/accounts/${provider}/transactions/${charge.body.id}.json`, ALICE, { description: 'Edited' }).expect(200);
        expect(patched.body.sent_to_accountant_at).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));

        const ledger = await send(app, 'get', transactionsPath(orgId, provider), ALICE).expect(200);
        const [paymentRow, chargeRow] = ledger.body.transactions;
        expect(paymentRow).not.toHaveProperty('sent_to_accountant_at');
        expect(chargeRow.sent_to_accountant_at).toBe(patched.body.sent_to_accountant_at);
        expect(ledger.body.opening).not.toHaveProperty('sent_to_accountant_at');

        const regularLedger = await send(app, 'get', transactionsPath(orgId, regular), ALICE).expect(200);
        expect(regularLedger.body.transactions[0]).not.toHaveProperty('sent_to_accountant_at');
      });

      it('a PATCH turning a sent charge positive clears the mark; flipping back yields an unsent charge', async () => {
        const provider = await createProvider(orgId);
        const id = await addTransaction(orgId, provider, '-10.00');
        await mark(orgId, 'sent', { transaction_ids: [id] }).expect(200);
        const itemPath = `${base(orgId)}/accounts/${provider}/transactions/${id}.json`;

        const flipped = await send(app, 'patch', itemPath, ALICE, { amount: '10.00' }).expect(200);
        expect(flipped.body).not.toHaveProperty('sent_to_accountant_at');
        expect(sentAtOf(id)).toBeNull();

        const back = await send(app, 'patch', itemPath, ALICE, { amount: '-10.00' }).expect(200);
        expect(back.body.sent_to_accountant_at).toBeNull();
        expect(await previewIds(orgId)).toEqual([id]);
      });

      it('deleting a sent charge works', async () => {
        const provider = await createProvider(orgId);
        const id = await addTransaction(orgId, provider, '-10.00');
        await mark(orgId, 'sent', { transaction_ids: [id] }).expect(200);

        await send(app, 'delete', `${base(orgId)}/accounts/${provider}/transactions/${id}.json`, ALICE).expect(204);

        expect(await previewIds(orgId, `${OCTOBER}&include_sent=true`)).toEqual([]);
      });

      it.each([
        ['sent_to_accountant_at', { sent_to_accountant_at: '2026-10-10T10:00:00Z' }],
        ['sentToAccountantAt', { sentToAccountantAt: '2026-10-10T10:00:00Z' }],
      ])('rejects a transaction body with %s (400)', async (_label, extra) => {
        const provider = await createProvider(orgId);
        const id = await addTransaction(orgId, provider, '-10.00');

        await send(app, 'post', transactionsPath(orgId, provider), ALICE, { date: '2026-10-05', amount: '-1.00', description: 'x', ...extra }).expect(400);
        await send(app, 'patch', `${base(orgId)}/accounts/${provider}/transactions/${id}.json`, ALICE, extra).expect(400);
        expect(sentAtOf(id)).toBeNull();
      });
    });
  });
});
