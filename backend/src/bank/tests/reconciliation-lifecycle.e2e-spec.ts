import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import { ALICE, buildBankTestApp, send } from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { CONTEXTS, reconciliationClient } from './support/reconciliation-e2e.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../payment-generated.query.js', () => jest.requireActual('./support/in-memory-payment-generated.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

// The whole reconciliation lifecycle (api/reconciliations.md, *Required tests*), end to end, under
// both base paths. The per-route, per-error-code and check-order coverage is in
// `reconciliations.e2e-spec.ts`, the ticks in `reconciliation-ticks.e2e-spec.ts` and the bounds in
// `reconciliation-bounds.e2e-spec.ts`.
//
// Account: opens 2026-01-01 at 1000.00. Rows: A +200.00 (01-10), B -50.00 (01-15), C +30.00 (01-20),
// D +7.00 (02-05). A, B and C bring the balance to 1180.00 on 2026-01-31, D to 1187.00 on 2026-02-28.

describe('reconciliation lifecycle (e2e)', () => {
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
    // A 2xx write carries the invalidation of the acting context's bank prefix; a 409 carries none.
    const invalidates = (response: request.Response): void => {
      expect(response.headers['x-cache-invalidate']).toBe(api().base);
    };
    const doesNotInvalidate = (response: request.Response): void => {
      expect(response.status).toBe(409);
      expect(response.headers['x-cache-invalidate']).toBeUndefined();
    };
    const setup = async () => {
      const client = api();
      const { id } = await client.account();
      const [a, b, c, d] = [
        await client.transaction(id, '2026-01-10', '200.00'),
        await client.transaction(id, '2026-01-15', '-50.00'),
        await client.transaction(id, '2026-01-20', '30.00'),
        await client.transaction(id, '2026-02-05', '7.00'),
      ];

      return { ...client, id, a, b, c, d };
    };

    it('runs start, tick, finish, undo and cancel, with the live values on every response', async () => {
      const { id, a, b, c, d, start, ticks, finish, undo, cancel, show } = await setup();

      // 1. Start.
      const started = await start(id, { statement_date: '2026-01-31', statement_balance: '1180.00' }).expect(201);
      invalidates(started);
      const statement = started.body.id as number;
      expect(started.body).toMatchObject({ cleared_balance: '1000.00', ticked_sum: '0.00', difference: '180.00', transaction_count: 0 });

      // 2. Tick and untick, checking the live difference each time.
      const first = await ticks(id, statement, { tick: [a, b] }).expect(200);
      invalidates(first);
      expect(first.body).toMatchObject({ ticked_sum: '150.00', difference: '30.00', transaction_count: 2 });
      const second = await ticks(id, statement, { tick: [c], untick: [b] }).expect(200);
      expect(second.body).toMatchObject({ ticked_sum: '230.00', difference: '-50.00', transaction_count: 2 });
      const third = await ticks(id, statement, { tick: [b] }).expect(200);
      expect(third.body).toMatchObject({ ticked_sum: '180.00', cleared_balance: '1000.00', difference: '0.00', transaction_count: 3 });
      doesNotInvalidate(await ticks(id, statement, { tick: [d] }));
      expect((await show(id, statement).expect(200)).body).toEqual(third.body);

      // 3. Finish at difference 0.
      const finished = await finish(id, statement).expect(200);
      invalidates(finished);
      expect(finished.body).toMatchObject({
        status: 'finished', difference: '0.00', ticked_sum: '180.00', cleared_balance: '1000.00', transaction_count: 3,
      });
      expect(finished.body.reconciled_at).toEqual(expect.any(String));
      expect([linkOf(a), linkOf(b), linkOf(c), linkOf(d)]).toEqual([statement, statement, statement, null]);
      doesNotInvalidate(await finish(id, statement));

      // 5. Undo: the statement reopens with its ticks kept.
      const reopened = await undo(id, statement).expect(200);
      invalidates(reopened);
      expect(reopened.body).toMatchObject({
        status: 'open', reconciled_at: null, ticked_sum: '180.00', cleared_balance: '1000.00', difference: '0.00', transaction_count: 3,
      });
      expect([linkOf(a), linkOf(b), linkOf(c)]).toEqual([statement, statement, statement]);

      // 6. Cancel: the ticks are dropped and the rows are uncleared.
      const cancelled = await cancel(id, statement).expect(204);
      invalidates(cancelled);
      expect([linkOf(a), linkOf(b), linkOf(c), linkOf(d)]).toEqual([null, null, null, null]);
      await show(id, statement).expect(404);
    });

    it('runs a zero-row statement: start, finish at 0, undo, cancel', async () => {
      const { id, start, finish, undo, cancel, list } = await setup();

      const started = await start(id, { statement_date: '2026-01-05', statement_balance: '1000.00' }).expect(201);
      const statement = started.body.id as number;
      expect(started.body).toMatchObject({ ticked_sum: '0.00', difference: '0.00', transaction_count: 0 });

      const finished = await finish(id, statement).expect(200);
      invalidates(finished);
      expect(finished.body).toMatchObject({ status: 'finished', difference: '0.00', ticked_sum: '0.00', transaction_count: 0 });
      expect((await list(id).expect(200)).body.reconciliations[0]).toMatchObject({ id: statement, undoable: true, transaction_count: 0 });

      expect((await undo(id, statement).expect(200)).body).toMatchObject({ status: 'open', difference: '0.00' });
      await cancel(id, statement).expect(204);
      expect((await list(id).expect(200)).body.reconciliations).toEqual([]);
    });

    it('counts the rows of the first statement in the second (chronology), and undoes it', async () => {
      const { id, a, b, c, d, start, ticks, finish, undo, cancel, show } = await setup();
      const first = (await start(id, { statement_date: '2026-01-31', statement_balance: '1180.00' }).expect(201)).body.id as number;
      await ticks(id, first, { tick: [a, b, c] }).expect(200);
      await finish(id, first).expect(200);

      const second = await start(id, { statement_date: '2026-02-28', statement_balance: '1187.00' }).expect(201);
      expect(second.body).toMatchObject({ cleared_balance: '1180.00', ticked_sum: '0.00', difference: '7.00' });
      await ticks(id, second.body.id, { tick: [d] }).expect(200);
      const secondFinished = await finish(id, second.body.id).expect(200);
      expect(secondFinished.body).toMatchObject({ status: 'finished', ticked_sum: '7.00', cleared_balance: '1180.00', difference: '0.00' });
      expect((await show(id, first).expect(200)).body).toMatchObject({ status: 'finished', difference: '0.00', ticked_sum: '180.00' });

      // Only the latest finished statement can be undone.
      doesNotInvalidate(await undo(id, first));
      const reopened = await undo(id, second.body.id).expect(200);
      invalidates(reopened);
      expect(reopened.body).toMatchObject({ status: 'open', ticked_sum: '7.00', cleared_balance: '1180.00', difference: '0.00' });

      // Cancelling the reopened second statement drops only its own tick; the first can then be undone.
      await cancel(id, second.body.id).expect(204);
      expect([linkOf(a), linkOf(b), linkOf(c), linkOf(d)]).toEqual([first, first, first, null]);
      const undone = await undo(id, first).expect(200);
      expect(undone.body).toMatchObject({ status: 'open', cleared_balance: '1000.00', ticked_sum: '180.00', difference: '0.00' });
    });

    // The existing routes (api/existing-routes.md): the transaction PATCH / DELETE and the account
    // PATCH, locked by a statement. Their own matrices are in `transaction-locks.e2e-spec.ts` and
    // `account-reconciliation-locks.e2e-spec.ts`.
    const transactionPath = (accountId: number, transactionId: number): string =>
      `${api().base}/accounts/${accountId}/transactions/${transactionId}.json`;
    const patchTransaction = (accountId: number, transactionId: number, body: object) =>
      send(app, 'patch', transactionPath(accountId, transactionId), ALICE, body);
    const deleteTransaction = (accountId: number, transactionId: number) => send(app, 'delete', transactionPath(accountId, transactionId), ALICE);
    const patchAccount = (accountId: number, body: object) => send(app, 'patch', `${api().base}/accounts/${accountId}.json`, ALICE, body);
    const codeOf = (response: request.Response): string => response.body.error.code;

    it('a cleared row: PATCH amount / date and DELETE answer 409 TRANSACTION_CLEARED, a description edit is allowed', async () => {
      const { id, a, b, c, start, ticks, finish } = await setup();
      const statement = (await start(id, { statement_date: '2026-01-31', statement_balance: '1180.00' }).expect(201)).body.id as number;
      await ticks(id, statement, { tick: [a, b, c] }).expect(200);
      await finish(id, statement).expect(200);

      for (const response of [
        await patchTransaction(id, a, { amount: '201.00' }),
        await patchTransaction(id, a, { date: '2026-01-11' }),
        await deleteTransaction(id, a),
      ]) {
        doesNotInvalidate(response);
        expect(codeOf(response)).toBe('TRANSACTION_CLEARED');
      }

      invalidates(await patchTransaction(id, a, { description: 'Renamed' }).expect(200));
      expect(repos.transactions.rows.find((row) => row.id === a)).toMatchObject({ amount: 20000n, date: '2026-01-10', description: 'Renamed' });
    });

    it('once undone, the rows of the statement unlock again (PATCH amount, DELETE succeed)', async () => {
      const { id, a, b, c, start, ticks, finish, undo } = await setup();
      const statement = (await start(id, { statement_date: '2026-01-31', statement_balance: '1180.00' }).expect(201)).body.id as number;
      await ticks(id, statement, { tick: [a, b, c] }).expect(200);
      await finish(id, statement).expect(200);
      await patchTransaction(id, a, { amount: '201.00' }).expect(409);

      await undo(id, statement).expect(200);

      invalidates(await patchTransaction(id, a, { amount: '201.00' }).expect(200));
      invalidates(await deleteTransaction(id, b).expect(204));
      expect(linkOf(a)).toBe(statement);
    });

    it('the account anchor and currency are 409 while a statement exists, open or finished', async () => {
      const { id, start, finish } = await setup();
      const statement = (await start(id, { statement_date: '2026-01-31', statement_balance: '1000.00' }).expect(201)).body.id as number;

      for (const state of ['open', 'finished']) {
        if (state === 'finished') {
          await finish(id, statement).expect(200);
        }

        for (const [body, code] of [
          [{ opening_date: '2025-12-31' }, 'ACCOUNT_RECONCILED'],
          [{ opening_balance: '1001.00' }, 'ACCOUNT_RECONCILED'],
          [{ currency: 'USD' }, 'CURRENCY_LOCKED'],
        ] as const) {
          const response = await patchAccount(id, body);

          doesNotInvalidate(response);
          expect(codeOf(response)).toBe(code);
        }
      }
    });

    it('the anchor and currency locks are released when the last statement is cancelled, and still held after an undo', async () => {
      const client = api();
      const { id: empty } = await client.account({ opening_balance: '0' });
      const { id, start, finish, undo, cancel } = await setup();
      const anchored = (await start(id, { statement_date: '2026-01-31', statement_balance: '1000.00' }).expect(201)).body.id as number;
      const zeroRow = (await start(empty, { statement_date: '2026-01-31', statement_balance: '0.00' }).expect(201)).body.id as number;
      await finish(id, anchored).expect(200);
      await finish(empty, zeroRow).expect(200);

      await undo(id, anchored).expect(200);
      await undo(empty, zeroRow).expect(200);
      expect(codeOf(await patchAccount(id, { opening_date: '2025-12-31' }))).toBe('ACCOUNT_RECONCILED');
      expect(codeOf(await patchAccount(empty, { currency: 'USD' }))).toBe('CURRENCY_LOCKED');

      await cancel(id, anchored).expect(204);
      await cancel(empty, zeroRow).expect(204);
      invalidates(await patchAccount(id, { opening_date: '2025-12-31', opening_balance: '1001.00' }).expect(200));
      invalidates(await patchAccount(empty, { currency: 'USD' }).expect(200));
    });
  });
});
