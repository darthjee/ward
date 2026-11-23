import type { INestApplication } from '@nestjs/common';
import { buildBankTestApp, NOT_FOUND_BODY, withoutTimestamp } from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { CONTEXTS, reconciliationClient } from './support/reconciliation-e2e.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

// `PATCH .../reconciliations/:id/ticks.json` (api/reconciliations.md and security.md): the bulk
// tick / untick, its eligibility causes, the whole-batch rollback and its body bounds.

describe('reconciliation ticks (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  const linkOf = (id: number): number | null => repos.transactions.rows.find((row) => row.id === id)!.reconciliationId;

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const api = () => reconciliationClient(app, orgId);

    describe('ticking', () => {
      it('ticks and unticks one batch and answers the recomputed statement', async () => {
        const { account, transaction, open, ticks, base } = api();
        const { id } = await account();
        const a = await transaction(id, '2026-01-10', '20.00');
        const b = await transaction(id, '2026-01-11', '-5.00');
        const statement = await open(id, '2026-02-28', '1015.00');

        const first = await ticks(id, statement, { tick: [a, b] }).expect(200);
        const second = await ticks(id, statement, { untick: [b] }).expect(200);

        expect(first.body).toMatchObject({ ticked_sum: '15.00', difference: '0.00', transaction_count: 2, cleared_balance: '1000.00' });
        expect(second.body).toMatchObject({ ticked_sum: '20.00', difference: '-5.00', transaction_count: 1 });
        expect(first.headers['x-cache-invalidate']).toBe(base);
        expect(first.headers['x-skip-cache']).toBe('true');
        expect([linkOf(a), linkOf(b)]).toEqual([statement, null]);
      });

      it('de-duplicates ids and treats re-ticks and untick of an unlinked or cleared row as no-ops', async () => {
        const { account, transaction, open, finish, ticks } = api();
        const { id } = await account();
        const cleared = await transaction(id, '2026-01-10', '10.00');
        const first = await open(id, '2026-01-31', '1010.00');
        await ticks(id, first, { tick: [cleared] }).expect(200);
        await finish(id, first).expect(200);
        const free = await transaction(id, '2026-02-10', '1.00');
        const ticked = await transaction(id, '2026-02-11', '2.00');
        const statement = await open(id, '2026-02-28', '1013.00');

        const response = await ticks(id, statement, { tick: [ticked, ticked, ticked], untick: [free, cleared, cleared] }).expect(200);
        await ticks(id, statement, { tick: [ticked] }).expect(200);

        expect(response.body).toMatchObject({ ticked_sum: '2.00', transaction_count: 1 });
        expect([linkOf(cleared), linkOf(free), linkOf(ticked)]).toEqual([first, null, statement]);
      });
    });

    describe('eligibility', () => {
      it.each([
        ['dated after the statement date', '2026-03-01'],
        ['dated before the opening date', '2025-12-31'],
      ])('answers 409 TRANSACTION_NOT_ELIGIBLE for a row %s and rolls the whole batch back', async (_label, date) => {
        const { account, transaction, open, ticks } = api();
        const { id } = await account();
        const fine = await transaction(id, '2026-02-01', '1.00');
        const bad = await transaction(id, date, '1.00');
        const statement = await open(id, '2026-02-28', '1000.00');

        const response = await ticks(id, statement, { tick: [fine, bad] }).expect(409);

        expect(response.body.error.code).toBe('TRANSACTION_NOT_ELIGIBLE');
        expect(response.headers['x-cache-invalidate']).toBeUndefined();
        expect(response.headers['x-skip-cache']).toBe('true');
        expect([linkOf(fine), linkOf(bad)]).toEqual([null, null]);
      });

      it('answers 409 TRANSACTION_NOT_ELIGIBLE for a row cleared by another statement', async () => {
        const { account, transaction, open, finish, ticks } = api();
        const { id } = await account();
        const cleared = await transaction(id, '2026-01-10', '1.00');
        const first = await open(id, '2026-01-31', '1001.00');
        await ticks(id, first, { tick: [cleared] }).expect(200);
        await finish(id, first).expect(200);
        const statement = await open(id, '2026-02-28', '1001.00');

        expect((await ticks(id, statement, { tick: [cleared] }).expect(409)).body.error.code).toBe('TRANSACTION_NOT_ELIGIBLE');
      });

      it('accepts rows on the opening date and on the statement date', async () => {
        const { account, transaction, open, ticks } = api();
        const { id } = await account();
        const onOpening = await transaction(id, '2026-01-01', '1.00');
        const onStatement = await transaction(id, '2026-02-28', '1.00');
        const statement = await open(id, '2026-02-28', '1002.00');

        await ticks(id, statement, { tick: [onOpening, onStatement] }).expect(200);
      });

      it('answers RECONCILIATION_FINISHED before TRANSACTION_NOT_ELIGIBLE in one batch', async () => {
        const { account, transaction, open, finish, ticks } = api();
        const { id } = await account();
        const late = await transaction(id, '2026-03-01', '1.00');
        const statement = await open(id, '2026-01-31', '1000.00');
        await finish(id, statement).expect(200);

        expect((await ticks(id, statement, { tick: [late] }).expect(409)).body.error.code).toBe('RECONCILIATION_FINISHED');
      });
    });

    describe('lookup', () => {
      it('answers the uniform 404 and rolls back the whole batch for an unknown or foreign id, in either array', async () => {
        const { account, transaction, open, ticks } = api();
        const { id } = await account();
        const { id: other } = await account();
        const mine = await transaction(id, '2026-02-01', '1.00');
        const foreign = await transaction(other, '2026-02-01', '1.00');
        const statement = await open(id, '2026-02-28', '1000.00');

        for (const body of [{ tick: [mine, foreign] }, { tick: [mine], untick: [foreign] }, { tick: [mine, 999_999] }]) {
          const response = await ticks(id, statement, body).expect(404);

          expect(withoutTimestamp(response)).toEqual({ error: NOT_FOUND_BODY.error, statusCode: 404 });
        }
        expect(linkOf(mine)).toBeNull();
        expect(linkOf(foreign)).toBeNull();
      });

      it('answers 400 for a bad body before any 404', async () => {
        const { ticks } = api();

        await ticks(999_999, 999_999, { tick: [] }).expect(400);
        await ticks(999_999, 999_999, { tick: [1], untick: [1] }).expect(400);
        await ticks(999_999, 999_999, { tick: [1] }).expect(404);
      });
    });

    describe('body bounds', () => {
      it('accepts 50 raw ids per array, duplicates included', async () => {
        const { account, transaction, open, ticks } = api();
        const { id } = await account();
        const row = await transaction(id, '2026-02-01', '1.00');
        const statement = await open(id, '2026-02-28', '1001.00');

        await ticks(id, statement, { tick: Array(50).fill(row) }).expect(200);
      });

      it.each([
        ['51 raw ids in tick', { tick: Array.from({ length: 51 }, (_v, i) => i + 1) }],
        ['51 raw ids in untick', { untick: Array.from({ length: 51 }, (_v, i) => i + 1) }],
        ['51 duplicate ids', { tick: Array(51).fill(1) }],
        ['overlapping arrays', { tick: [1, 2], untick: [2] }],
        ['two empty arrays', { tick: [], untick: [] }],
        ['an empty body', {}],
        ['a non-integer id', { tick: [1.5] }],
        ['a string id', { tick: ['1'] }],
        ['a zero id', { tick: [0] }],
        ['an id over MAX_ID', { untick: [2147483648] }],
        ['an extra field', { tick: [1], color: 'red' }],
        ['reconciliation_id', { tick: [1], reconciliation_id: 3 }],
        ['account_id', { tick: [1], account_id: 3 }],
        ['status', { tick: [1], status: 'finished' }],
        ['transaction_ids', { transaction_ids: [1] }],
      ])('answers 400 for %s', async (_label, body) => {
        const { account, open, ticks } = api();
        const { id } = await account();
        const statement = await open(id, '2026-02-28', '1000.00');

        const response = await ticks(id, statement, body).expect(400);

        expect(response.headers['x-cache-invalidate']).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('2147483648');
      });
    });
  });

  it('is only reachable through the owner of the account (Bob cannot tick Alice\'s rows)', async () => {
    const { account, transaction, open, ticks } = reconciliationClient(app, null);
    const { id } = await account();
    const row = await transaction(id, '2026-02-01', '1.00');
    const statement = await open(id, '2026-02-28', '1001.00');

    await ticks(id, statement, { tick: [row] }, '8').expect(404);
    expect(linkOf(row)).toBeNull();
  });
});
