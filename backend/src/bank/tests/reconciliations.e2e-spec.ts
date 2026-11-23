import type { INestApplication } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ADMIN, ALICE_ORG, BOB, buildBankTestApp, beforeNextTransaction, NOT_FOUND_BODY, send, withoutTimestamp } from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { ORG_MEMBERS, seedOrgRoles, UNIFORM_403 } from './support/owner-matrix.js';
import { CONTEXTS, reconciliationClient } from './support/reconciliation-e2e.js';
import { OrgRole } from '../../core/org-role.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

// Routes, error codes and check order of `api/reconciliations.md`, under both base paths. The ticks
// and the bounds have their own specs; the end-to-end flow is `reconciliation-lifecycle.e2e-spec.ts`.

const DUPLICATE = new QueryFailedError('q', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
const DEADLOCK = new QueryFailedError('q', [], Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' }));

describe('reconciliations (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  beforeAll(async () => {
    let seedMembership: Parameters<typeof seedOrgRoles>[0];
    ({ app, repos, seedMembership } = await buildBankTestApp());
    seedOrgRoles(seedMembership);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const api = () => reconciliationClient(app, orgId);

    describe('start', () => {
      it('creates an open statement (201) and invalidates the bank prefix', async () => {
        const { account, start, base } = api();
        const { id } = await account();

        const response = await start(id, { statement_date: '2026-02-28', statement_balance: '1000.00' }).expect(201);

        expect(response.body).toEqual({
          id: expect.any(Number),
          status: 'open',
          statement_date: '2026-02-28',
          statement_balance: '1000.00',
          reconciled_at: null,
          cleared_balance: '1000.00',
          ticked_sum: '0.00',
          difference: '0.00',
          transaction_count: 0,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        });
        expect(response.headers['x-cache-invalidate']).toBe(base);
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(response.headers['cache-control']).toBe('no-store');
      });

      it('accepts a date equal to the opening date', async () => {
        const { account, start } = api();
        const { id } = await account();

        await start(id, { statement_date: '2026-01-01', statement_balance: '0' }).expect(201);
      });

      it('answers 409 RECONCILIATION_OPEN to a second start, with no invalidation', async () => {
        const { account, start, open } = api();
        const { id } = await account();
        await open(id, '2026-02-28', '1000.00');

        const response = await start(id, { statement_date: '2026-03-31', statement_balance: '1000.00' }).expect(409);

        expect(withoutTimestamp(response)).toEqual({ error: { code: 'RECONCILIATION_OPEN', message: expect.any(String) }, statusCode: 409 });
        expect(response.headers['x-cache-invalidate']).toBeUndefined();
        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('answers 409 RECONCILIATION_OUT_OF_ORDER for a date not after the latest finished one, and 400 when it also breaks the opening date', async () => {
        const { account, start, open, finish } = api();
        const { id } = await account({ opening_date: '2026-01-10' });
        await finish(id, await open(id, '2026-02-28', '1000.00')).expect(200);

        const equal = await start(id, { statement_date: '2026-02-28', statement_balance: '1.00' }).expect(409);
        await start(id, { statement_date: '2026-01-05', statement_balance: '1.00' }).expect(400);
        await start(id, { statement_date: '2026-03-01', statement_balance: '1.00' }).expect(201);

        expect(equal.body.error.code).toBe('RECONCILIATION_OUT_OF_ORDER');
      });

      it('answers a concurrent start with 409 RECONCILIATION_OPEN, never a 500', async () => {
        const { account, start } = api();
        const { id } = await account();
        const rival = { accountId: id, statementDate: '2026-02-28', statementBalance: 0n, reconciledAt: null };

        beforeNextTransaction(app, () => repos.reconciliations.save(repos.reconciliations.create(rival)));
        const response = await start(id, { statement_date: '2026-03-31', statement_balance: '1.00' }).expect(409);

        expect(response.body.error.code).toBe('RECONCILIATION_OPEN');
        expect(repos.reconciliations.rows.filter((row) => row.accountId === id)).toHaveLength(1);
      });

      it('answers a unique-key violation raised by the insert itself with 409 RECONCILIATION_OPEN', async () => {
        const { account, start } = api();
        const { id } = await account();
        jest.spyOn(repos.reconciliations, 'save').mockRejectedValueOnce(DUPLICATE);

        const response = await start(id, { statement_date: '2026-03-31', statement_balance: '1.00' }).expect(409);

        expect(response.body.error.code).toBe('RECONCILIATION_OPEN');
      });

      it('answers an injected deadlock with the uniform 409 CONCURRENT_UPDATE, never a 500', async () => {
        const { account, start } = api();
        const { id } = await account();
        jest.spyOn(repos.reconciliations, 'save').mockRejectedValueOnce(DEADLOCK);

        const response = await start(id, { statement_date: '2026-03-31', statement_balance: '1.00' }).expect(409);

        expect(response.body.error).toEqual({ code: 'CONCURRENT_UPDATE', message: expect.any(String) });
        expect(response.headers['x-cache-invalidate']).toBeUndefined();
      });
    });

    describe('edit', () => {
      it('edits an open statement and keeps the chronology for finished statements only', async () => {
        const { account, open, finish, edit } = api();
        const { id } = await account();
        await finish(id, await open(id, '2026-01-31', '1000.00')).expect(200);
        const statement = await open(id, '2026-02-28', '1000.00');

        const balance = await edit(id, statement, { statement_balance: '12.50' }).expect(200);
        const moved = await edit(id, statement, { statement_date: '2026-03-15' }).expect(200);
        const outOfOrder = await edit(id, statement, { statement_date: '2026-01-31' }).expect(409);

        expect(balance.body).toMatchObject({ statement_balance: '12.50', difference: '-987.50' });
        expect(moved.body.statement_date).toBe('2026-03-15');
        expect(outOfOrder.body.error.code).toBe('RECONCILIATION_OUT_OF_ORDER');
        expect(balance.headers['x-cache-invalidate']).toBe(api().base);
        expect(outOfOrder.headers['x-cache-invalidate']).toBeUndefined();
      });

      it('answers 409 RECONCILIATION_FINISHED on a finished statement', async () => {
        const { account, open, finish, edit } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '1000.00');
        await finish(id, statement).expect(200);

        expect((await edit(id, statement, { statement_balance: '1.00' }).expect(409)).body.error.code).toBe('RECONCILIATION_FINISHED');
      });
    });

    describe('finish, cancel and undo', () => {
      it('refuses to finish an unbalanced statement, then a second finish', async () => {
        const { account, open, finish } = api();
        const { id } = await account();
        const unbalanced = await open(id, '2026-01-31', '1000.01');

        expect((await finish(id, unbalanced).expect(409)).body.error.code).toBe('RECONCILIATION_UNBALANCED');
        const { id: other } = await account();
        const balanced = await open(other, '2026-01-31', '1000.00');
        await finish(other, balanced).expect(200);
        expect((await finish(other, balanced).expect(409)).body.error.code).toBe('RECONCILIATION_FINISHED');
      });

      it('cancels an open statement (204) and refuses a finished one (409)', async () => {
        const { account, open, finish, cancel, base } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '1000.00');

        const done = await cancel(id, statement).expect(204);
        const finished = await open(id, '2026-01-31', '1000.00');
        await finish(id, finished).expect(200);

        expect(done.headers['x-cache-invalidate']).toBe(base);
        expect((await cancel(id, finished).expect(409)).body.error.code).toBe('RECONCILIATION_FINISHED');
      });

      it('answers the undo errors NOT_FINISHED, OPEN and NOT_LATEST, then undoes the latest', async () => {
        const { account, open, finish, undo, cancel } = api();
        const { id } = await account();
        const first = await open(id, '2026-01-31', '1000.00');
        await finish(id, first).expect(200);
        const second = await open(id, '2026-02-28', '1000.00');

        expect((await undo(id, second).expect(409)).body.error.code).toBe('RECONCILIATION_NOT_FINISHED');
        await finish(id, second).expect(200);
        const third = await open(id, '2026-03-31', '1000.00');
        expect((await undo(id, second).expect(409)).body.error.code).toBe('RECONCILIATION_OPEN');
        await cancel(id, third).expect(204);
        expect((await undo(id, first).expect(409)).body.error.code).toBe('RECONCILIATION_NOT_LATEST');
        expect((await undo(id, second).expect(200)).body).toMatchObject({ id: second, status: 'open', reconciled_at: null });
      });

      it('answers undo versus a concurrent start with 409 RECONCILIATION_OPEN', async () => {
        const { account, open, finish, undo } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '1000.00');
        await finish(id, statement).expect(200);

        beforeNextTransaction(app, () => repos.reconciliations.save(repos.reconciliations.create({
          accountId: id, statementDate: '2026-02-28', statementBalance: 0n, reconciledAt: null,
        })));
        const response = await undo(id, statement).expect(409);

        expect(response.body.error.code).toBe('RECONCILIATION_OPEN');
      });

      it('answers a deadlock on finish with the uniform 409', async () => {
        const { account, open, finish } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '1000.00');
        jest.spyOn(repos.reconciliations, 'delete').mockRejectedValueOnce(DEADLOCK);
        const { cancel } = api();

        expect((await cancel(id, statement).expect(409)).body.error.code).toBe('CONCURRENT_UPDATE');
        await finish(id, statement).expect(200);
      });
    });

    describe('history and lookup', () => {
      it('lists the open statement first, newest first, with undoable and transaction_count', async () => {
        const { account, open, finish, ticks, list, transaction } = api();
        const { id } = await account();
        const first = await open(id, '2026-01-31', '1000.00');
        await finish(id, first).expect(200);
        const tx = await transaction(id, '2026-02-10', '25.00');
        const second = await open(id, '2026-02-28', '1025.00');
        await ticks(id, second, { tick: [tx] }).expect(200);
        await finish(id, second).expect(200);

        const finishedOnly = await list(id).expect(200);
        const third = await open(id, '2026-03-31', '1025.00');
        const withOpen = await list(id).expect(200);

        expect(finishedOnly.body.reconciliations.map((row: Record<string, unknown>) => [row.id, row.undoable, row.transaction_count]))
          .toEqual([[second, true, 1], [first, false, 0]]);
        expect(withOpen.body.reconciliations.map((row: Record<string, unknown>) => [row.id, row.status, row.undoable]))
          .toEqual([[third, 'open', false], [second, 'finished', false], [first, 'finished', false]]);
        expect(withOpen.body.reconciliations[1]).toEqual({
          id: second,
          status: 'finished',
          statement_date: '2026-02-28',
          statement_balance: '1025.00',
          reconciled_at: expect.any(String),
          transaction_count: 1,
          undoable: false,
        });
        expect(withOpen.body.pagination).toEqual({ page: 1, per_page: 50, total_pages: 1, total_count: 3 });
        expect(withOpen.headers['x-cache-allow']).toBe('true');
        expect(withOpen.headers['x-skip-cache']).toBeUndefined();
        expect(withOpen.headers['x-cache-invalidate']).toBeUndefined();
      });

      it('pages 50 per page and answers 400 to a malformed page', async () => {
        const { account, list } = api();
        const { id } = await account();
        for (let month = 0; month < 51; month++) {
          await repos.reconciliations.save(repos.reconciliations.create({
            accountId: id,
            statementDate: new Date(Date.UTC(2020, month, 1)).toISOString().slice(0, 10),
            statementBalance: 0n,
            reconciledAt: new Date(),
          }));
        }

        expect((await list(id, '?page=1').expect(200)).body.reconciliations).toHaveLength(50);
        expect((await list(id, '?page=2').expect(200)).body.reconciliations).toHaveLength(1);
        for (const page of ['0', '-1', 'abc', '1.5']) {
          await list(id, `?page=${page}`).expect(400);
        }
      });

      it('answers 404 to a statement of a sibling account on every route', async () => {
        const { account, open, show, edit, cancel, ticks, finish, undo } = api();
        const { id: mine } = await account();
        const { id: sibling } = await account();
        const statement = await open(sibling, '2026-01-31', '1000.00');

        const responses = [
          await show(mine, statement), await edit(mine, statement, { statement_balance: '1.00' }), await cancel(mine, statement),
          await ticks(mine, statement, { tick: [1] }), await finish(mine, statement), await undo(mine, statement),
        ];

        for (const response of responses) {
          expect(response.status).toBe(404);
          expect(withoutTimestamp(response)).toEqual({ error: NOT_FOUND_BODY.error, statusCode: 404 });
        }
        await show(sibling, statement).expect(200);
      });
    });

    describe('archived accounts', () => {
      it('answers ACCOUNT_ARCHIVED before the state 409s, keeps the GETs, and works again after unarchive', async () => {
        const { account, open, finish, start, show, list, edit, cancel, ticks, undo, archive, unarchive, transaction } = api();
        const { id } = await account();
        const row = await transaction(id, '2026-01-10', '5.00');
        const first = await open(id, '2026-01-31', '1000.00');
        await finish(id, first).expect(200);
        const second = await open(id, '2026-02-28', '1000.00');
        await archive(id);

        const writes = [
          await start(id, { statement_date: '2026-03-31', statement_balance: '1.00' }),
          await edit(id, second, { statement_balance: '1.00' }),
          await ticks(id, second, { tick: [row] }),
          await finish(id, second),
          await cancel(id, second),
          await undo(id, first),
        ];
        const finishedEdit = await edit(id, first, { statement_balance: '1.00' });

        for (const response of [...writes, finishedEdit]) {
          expect(response.status).toBe(409);
          expect(response.body.error.code).toBe('ACCOUNT_ARCHIVED');
        }
        await show(id, second).expect(200);
        await list(id).expect(200);
        await unarchive(id);
        await finish(id, second).expect(200);
      });
    });

    describe('access', () => {
      it('answers the uniform 404 to a non-member, a foreign account and a global admin', async () => {
        const { account, open, start, list } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '1000.00');
        const body = { statement_date: '2026-02-28', statement_balance: '1.00' };

        for (const [user, admin] of [[BOB, false], [ADMIN, true]] as const) {
          const responses = [
            await send(app, 'get', `${api().base}/accounts/${id}/reconciliations.json`, user, undefined, admin),
            await send(app, 'get', `${api().base}/accounts/${id}/reconciliations/${statement}.json`, user, undefined, admin),
            await send(app, 'post', `${api().base}/accounts/${id}/reconciliations.json`, user, body, admin),
            await send(app, 'post', `${api().base}/accounts/${id}/reconciliations/${statement}/finish.json`, user, {}, admin),
          ];

          for (const response of responses) {
            expect(response.status).toBe(404);
            expect(response.headers['x-cache-invalidate']).toBeUndefined();
          }
        }
        await start(999_999, body).expect(404);
        await list('abc').expect(404);
      });

      it('lets the personal context act as owner (cancel and undo succeed)', async () => {
        if (orgId !== null) return;
        const { account, open, finish, undo, cancel } = api();
        const { id } = await account();
        const statement = await open(id, '2026-01-31', '1000.00');
        await finish(id, statement).expect(200);

        await undo(id, statement).expect(200);
        await cancel(id, statement).expect(204);
      });
    });

    it('never puts a balance, date, id or count in a 409 or 400 body', async () => {
      const { account, open, start, edit, finish } = api();
      const { id } = await account();
      const statement = await open(id, '2026-02-28', '4321.09');
      const responses = [
        await start(id, { statement_date: '2026-03-31', statement_balance: '4321.09' }).expect(409),
        await finish(id, statement).expect(409),
        await edit(id, statement, { statement_balance: '4321.099' }).expect(400),
      ];

      for (const response of responses) {
        expect(response.body.error.message).not.toMatch(/4321|2026|099|\b\d{3,}/);
        expect(response.headers['x-cache-invalidate']).toBeUndefined();
      }
    });
  });

  describe('roles (organization base path)', () => {
    const api = () => reconciliationClient(app, ALICE_ORG);

    it('gives a user 403 on cancel and undo, even with an invalid body, and for any statement id', async () => {
      const { account, open, cancel, undo } = api();
      const { id } = await account();
      const statement = await open(id, '2026-01-31', '1000.00');
      const user = ORG_MEMBERS[OrgRole.USER];

      for (const response of [
        await cancel(id, statement, user),
        await cancel(id, 999_999, user),
        await undo(id, statement, { color: 'red' }, user),
        await undo(id, 999_999, {}, user),
      ]) {
        expect(response.status).toBe(403);
        expect(withoutTimestamp(response)).toEqual(UNIFORM_403);
      }
      expect(repos.reconciliations.rows.some((row) => row.id === statement)).toBe(true);
    });

    it.each([OrgRole.ADMIN, OrgRole.OWNER])('lets an %s cancel and undo', async (role) => {
      const { account, open, finish, undo, cancel } = api();
      const { id } = await account();
      const statement = await open(id, '2026-01-31', '1000.00');
      await finish(id, statement).expect(200);

      await undo(id, statement, {}, ORG_MEMBERS[role]).expect(200);
      await cancel(id, statement, ORG_MEMBERS[role]).expect(204);
    });

    it('lets a user start, edit, tick and finish', async () => {
      const { account, start, edit, ticks, finish, transaction } = api();
      const { id } = await account();
      const user = ORG_MEMBERS[OrgRole.USER];
      const tx = await transaction(id, '2026-01-10', '5.00');

      const statement = (await start(id, { statement_date: '2026-02-28', statement_balance: '1005.00' }, user).expect(201)).body.id;
      await edit(id, statement, { statement_balance: '1005.00' }, user).expect(200);
      await ticks(id, statement, { tick: [tx] }, user).expect(200);
      await finish(id, statement, {}, user).expect(200);
    });
  });
});
