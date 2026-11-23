import type { INestApplication } from '@nestjs/common';
import { todayUtc } from '../ledger-date.js';
import { addDays } from '../occurrence-generator.js';
import { buildBankTestApp } from './support/build-bank-test-app.js';
import { CONTEXTS, reconciliationClient } from './support/reconciliation-e2e.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

// Input bounds of start and edit (security.md, *Input bounds*): the date window, the balance bound
// (|value| <= 10^13 minor units), strict bodies and the mass-assignment fields.

const BASE = { statement_date: '2026-02-28', statement_balance: '10.00' };
// 10^13 minor units of BRL (two decimals).
const MAX = '100000000000.00';
const OVER = '100000000000.01';

describe('reconciliation bounds (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const api = () => reconciliationClient(app, orgId);
    const tomorrow = (): string => addDays(todayUtc(new Date()), 1);
    const dayAfter = (): string => addDays(todayUtc(new Date()), 2);

    describe('statement_date', () => {
      it('accepts UTC today + 1 day and rejects the day after, on start and on edit', async () => {
        const { account, start, edit } = api();
        const { id } = await account();

        await start(id, { ...BASE, statement_date: dayAfter() }).expect(400);
        const statement = (await start(id, { ...BASE, statement_date: tomorrow() }).expect(201)).body.id;
        await edit(id, statement, { statement_date: dayAfter() }).expect(400);
        await edit(id, statement, { statement_date: tomorrow() }).expect(200);
      });

      it.each([
        ['a malformed date', '28/02/2026'],
        ['an impossible date', '2026-02-30'],
        ['a null date', null],
        ['a numeric date', 20260228],
      ])('rejects %s with a 400', async (_label, date) => {
        const { account, start } = api();
        const { id } = await account();

        await start(id, { ...BASE, statement_date: date }).expect(400);
      });

      it('rejects a date before the opening date with a 400 (also on edit)', async () => {
        const { account, start, open, edit } = api();
        const { id } = await account({ opening_date: '2026-01-10' });
        const statement = await open(id, '2026-02-28', '10.00');

        await start(id, { ...BASE, statement_date: '2026-01-09' }).expect(400);
        await edit(id, statement, { statement_date: '2026-01-09' }).expect(400);
        await edit(id, statement, { statement_date: '2026-01-10' }).expect(200);
      });
    });

    describe('statement_balance', () => {
      it.each([['a negative balance', '-12.30'], ['zero', '0'], ['the 10^13 bound', MAX], ['minus the 10^13 bound', `-${MAX}`]])(
        'accepts %s',
        async (_label, balance) => {
          const { account, start } = api();
          const { id } = await account();

          await start(id, { ...BASE, statement_balance: balance }).expect(201);
        },
      );

      it.each([
        ['10^13 + 1', OVER],
        ['minus 10^13 - 1', `-${OVER}`],
        ['too many decimals', '1.234'],
        ['text', 'abc'],
        ['an exponent', '1e3'],
        ['a number instead of a string', 5],
        ['null', null],
      ])('rejects %s with a 400, on start and on edit', async (_label, balance) => {
        const { account, start, open, edit } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '10.00');
        const { id: other } = await account();

        await start(other, { ...BASE, statement_balance: balance }).expect(400);
        await edit(id, statement, { statement_balance: balance }).expect(400);
      });
    });

    describe('strict bodies', () => {
      it.each([
        ['an unknown field', { color: 'red' }],
        ['account_id', { account_id: 3 }],
        ['status', { status: 'finished' }],
        ['reconciled_at', { reconciled_at: '2026-01-01T00:00:00Z' }],
        ['reconciliation_id', { reconciliation_id: 3 }],
        ['reconciliation', { reconciliation: { id: 3 } }],
        ['id', { id: 3 }],
      ])('rejects %s on start and on edit', async (_label, extra) => {
        const { account, start, open, edit } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '10.00');
        const { id: other } = await account();

        await start(other, { ...BASE, ...extra }).expect(400);
        await edit(id, statement, extra).expect(400);
      });

      it('requires both fields on start', async () => {
        const { account, start } = api();
        const { id } = await account();

        await start(id, { statement_date: '2026-02-28' }).expect(400);
        await start(id, { statement_balance: '1.00' }).expect(400);
        await start(id, {}).expect(400);
      });

      it('rejects any field on finish and undo (they take {})', async () => {
        const { account, open, finish, undo } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '1000.00');

        await finish(id, statement, { status: 'finished' }).expect(400);
        await undo(id, statement, { color: 'red' }).expect(400);
        await finish(id, statement, {}).expect(200);
        await undo(id, statement, {}).expect(200);
      });
    });
  });
});
