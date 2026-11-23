import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { buildReconciliationServices, type ReconciliationServices } from './support/build-reconciliation-services.js';
import { ReconciliationQuery } from './support/in-memory-reconciliation.query.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { ReconciliationTicksDto } from '../dto/reconciliation.dto.js';

const ticks = (tick: number[], untick: number[] = []): ReconciliationTicksDto =>
  Object.assign(new ReconciliationTicksDto(), { tick, untick });

async function failureOf(work: Promise<unknown>): Promise<unknown> {
  return work.then(() => { throw new Error('expected a rejection'); }, (error: unknown) => error);
}

async function expectConflict(work: Promise<unknown>, code: string): Promise<void> {
  const error = await failureOf(work);

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).getResponse()).toMatchObject({ code });
}

describe('ReconciliationService', () => {
  let s: ReconciliationServices;
  let accountId: number;

  beforeEach(async () => {
    s = buildReconciliationServices();
    ReconciliationQuery.lockCalls = [];
    ReconciliationQuery.countCalls = 0;
    accountId = (await s.seedAccount({ openingDate: '2026-01-01', openingBalance: 100_000n })).id;
  });

  describe('start', () => {
    it('opens a statement showing the live values', async () => {
      await s.seedTransaction(accountId, '2026-01-10', 5_000n);

      const view = await s.service.start(s.owner, accountId, { statement_date: '2026-02-28', statement_balance: '1000.00' });

      expect(view).toMatchObject({
        status: 'open',
        statement_date: '2026-02-28',
        statement_balance: '1000.00',
        reconciled_at: null,
        cleared_balance: '1000.00',
        ticked_sum: '0.00',
        difference: '0.00',
        transaction_count: 0,
      });
    });

    it('accepts a date equal to the opening date and a negative or zero balance', async () => {
      await expect(s.service.start(s.owner, accountId, { statement_date: '2026-01-01', statement_balance: '-12.30' })).resolves
        .toMatchObject({ statement_balance: '-12.30', difference: '-1012.30' });
    });

    it('locks the account row (and no other) before checking', async () => {
      const start = await s.service.start(s.owner, accountId, { statement_date: '2026-02-28', statement_balance: '1.00' });

      expect(start.id).toBeGreaterThan(0);
      expect(s.lockOrder).toEqual(['Account']);
    });

    it.each([
      ['a balance with too many decimals', { statement_date: '2026-02-28', statement_balance: '1.234' }],
      ['a balance beyond the bound', { statement_date: '2026-02-28', statement_balance: '100000000000.01' }],
      ['a malformed balance', { statement_date: '2026-02-28', statement_balance: 'abc' }],
      ['a date before the opening date', { statement_date: '2025-12-31', statement_balance: '1.00' }],
    ])('rejects %s with a 400 that echoes no value', async (_label, dto) => {
      const error = await failureOf(s.service.start(s.owner, accountId, dto));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify((error as BadRequestException).getResponse())).not.toMatch(/2025|2026|1\.234|100000000000/);
    });

    it('answers 404 for an unknown account', async () => {
      await expect(s.service.start(s.owner, 999, { statement_date: '2026-02-28', statement_balance: '1.00' })).rejects
        .toBeInstanceOf(NotFoundException);
    });

    it('checks the 400, then ACCOUNT_ARCHIVED, then RECONCILIATION_OPEN, then RECONCILIATION_OUT_OF_ORDER', async () => {
      const archived = (await s.seedAccount({ archivedAt: new Date() })).id;
      await s.seedStatement(accountId, '2026-01-31', 100_000n, true);
      await s.seedStatement(accountId, '2026-03-31', 100_000n);
      const late = { statement_date: '2026-01-31', statement_balance: '1.00' };

      await expect(s.service.start(s.owner, archived, { ...late, statement_date: '2025-01-01' })).rejects.toBeInstanceOf(BadRequestException);
      await expectConflict(s.service.start(s.owner, archived, late), ErrorCodes.ACCOUNT_ARCHIVED);
      await expectConflict(s.service.start(s.owner, accountId, late), ErrorCodes.RECONCILIATION_OPEN);
      await s.service.cancel(s.owner, accountId, (await s.repos.reconciliations.findOneBy({ reconciledAt: null }))!.id);
      await expectConflict(s.service.start(s.owner, accountId, late), ErrorCodes.RECONCILIATION_OUT_OF_ORDER);
      await expect(s.service.start(s.owner, accountId, { ...late, statement_date: '2026-02-01' })).resolves.toMatchObject({ status: 'open' });
    });

    it('maps a unique open_key violation (a concurrent start) to RECONCILIATION_OPEN', async () => {
      const duplicate = new QueryFailedError('q', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
      jest.spyOn(s.repos.reconciliations, 'save').mockRejectedValueOnce(duplicate);

      await expectConflict(s.service.start(s.owner, accountId, { statement_date: '2026-02-28', statement_balance: '1.00' }), ErrorCodes.RECONCILIATION_OPEN);
    });

    it('maps a deadlock to CONCURRENT_UPDATE', async () => {
      const deadlock = new QueryFailedError('q', [], Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' }));
      jest.spyOn(s.manager, 'transaction').mockRejectedValueOnce(deadlock);

      await expectConflict(s.service.start(s.owner, accountId, { statement_date: '2026-02-28', statement_balance: '1.00' }), ErrorCodes.CONCURRENT_UPDATE);
    });
  });

  describe('edit', () => {
    it('edits the balance without a chronology check and the date against finished statements only', async () => {
      await s.seedStatement(accountId, '2026-01-31', 100_000n, true);
      const open = await s.seedStatement(accountId, '2026-02-28', 100_000n);

      await expect(s.service.edit(s.owner, accountId, open.id, { statement_balance: '5.00' })).resolves.toMatchObject({ statement_balance: '5.00' });
      await expect(s.service.edit(s.owner, accountId, open.id, { statement_date: '2026-03-15' })).resolves.toMatchObject({ statement_date: '2026-03-15' });
      await expectConflict(s.service.edit(s.owner, accountId, open.id, { statement_date: '2026-01-31' }), ErrorCodes.RECONCILIATION_OUT_OF_ORDER);
      await expect(s.service.edit(s.owner, accountId, open.id, { statement_date: '2026-03-15', statement_balance: '6.00' })).resolves.toMatchObject({ statement_balance: '6.00' });
    });

    it('unticks the rows that fall after a date moved earlier, keeping the boundary', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 100_000n);
      const keep = await s.seedTransaction(accountId, '2026-02-10', 1n, open.id);
      const boundary = await s.seedTransaction(accountId, '2026-02-15', 2n, open.id);
      const drop = await s.seedTransaction(accountId, '2026-02-16', 3n, open.id);

      const view = await s.service.edit(s.owner, accountId, open.id, { statement_date: '2026-02-15' });

      expect(view).toMatchObject({ ticked_sum: '0.03', transaction_count: 2 });
      expect([keep, boundary, drop].map((row) => s.repos.transactions.rows.find((r) => r.id === row.id)!.reconciliationId))
        .toEqual([open.id, open.id, null]);
    });

    it('checks 400, then ACCOUNT_ARCHIVED, then RECONCILIATION_FINISHED, with a uniform 404 first', async () => {
      const finished = await s.seedStatement(accountId, '2026-01-31', 100_000n, true);
      const archived = (await s.seedAccount({ archivedAt: new Date() })).id;
      const archivedStatement = await s.seedStatement(archived, '2026-01-31', 0n, true);

      await expect(s.service.edit(s.owner, accountId, 999, { statement_balance: '1.00' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(s.service.edit(s.owner, accountId, archivedStatement.id, { statement_balance: '1.00' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(s.service.edit(s.owner, accountId, finished.id, { statement_balance: '1.234' })).rejects.toBeInstanceOf(BadRequestException);
      await expectConflict(s.service.edit(s.owner, archived, archivedStatement.id, { statement_balance: '1.00' }), ErrorCodes.ACCOUNT_ARCHIVED);
      await expectConflict(s.service.edit(s.owner, accountId, finished.id, { statement_balance: '1.00' }), ErrorCodes.RECONCILIATION_FINISHED);
    });
  });

  describe('cancel', () => {
    it('deletes the statement and drops its ticks', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 0n);
      const row = await s.seedTransaction(accountId, '2026-02-10', 1n, open.id);

      await expect(s.service.cancel(s.owner, accountId, open.id)).resolves.toBeUndefined();

      expect(s.repos.reconciliations.rows).toHaveLength(0);
      expect(s.repos.transactions.rows.find((r) => r.id === row.id)!.reconciliationId).toBeNull();
    });

    it('answers FINISHED for a finished statement, ACCOUNT_ARCHIVED first on an archived account', async () => {
      const finished = await s.seedStatement(accountId, '2026-01-31', 0n, true);
      const archived = (await s.seedAccount({ archivedAt: new Date() })).id;
      const open = await s.seedStatement(archived, '2026-01-31', 0n);

      await expectConflict(s.service.cancel(s.owner, accountId, finished.id), ErrorCodes.RECONCILIATION_FINISHED);
      await expectConflict(s.service.cancel(s.owner, archived, open.id), ErrorCodes.ACCOUNT_ARCHIVED);
      await expect(s.service.cancel(s.owner, accountId, 999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('tick', () => {
    it('ticks and unticks in one batch, de-duplicated, and recomputes the difference', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 103_000n);
      const a = await s.seedTransaction(accountId, '2026-01-10', 2_000n);
      const b = await s.seedTransaction(accountId, '2026-01-11', 1_000n);
      const ticked = await s.seedTransaction(accountId, '2026-01-12', 500n, open.id);

      const view = await s.service.tick(s.owner, accountId, open.id, ticks([a.id, b.id, a.id], [ticked.id]));

      expect(view).toMatchObject({ ticked_sum: '30.00', transaction_count: 2, difference: '0.00' });
      expect(s.lockOrder).toEqual(['Account', 'Reconciliation', 'Transaction']);
      expect(ReconciliationQuery.lockCalls).toEqual([[a.id, b.id, ticked.id].sort((x, y) => x - y)]);
    });

    it('treats re-ticking a ticked row and unticking an unticked or cleared row as no-ops', async () => {
      const finished = await s.seedStatement(accountId, '2026-01-31', 0n, true);
      const open = await s.seedStatement(accountId, '2026-02-28', 0n);
      const already = await s.seedTransaction(accountId, '2026-02-01', 100n, open.id);
      const free = await s.seedTransaction(accountId, '2026-02-02', 200n);
      const cleared = await s.seedTransaction(accountId, '2026-01-20', 300n, finished.id);

      const view = await s.service.tick(s.owner, accountId, open.id, ticks([already.id], [free.id, cleared.id]));

      expect(view).toMatchObject({ ticked_sum: '1.00', transaction_count: 1 });
      expect(s.repos.transactions.rows.find((r) => r.id === cleared.id)!.reconciliationId).toBe(finished.id);
    });

    it.each([
      ['dated after the statement date', '2026-03-01', null],
      ['dated before the opening date', '2025-12-31', null],
    ])('rejects a row %s with TRANSACTION_NOT_ELIGIBLE and applies none of the batch', async (_label, date) => {
      const open = await s.seedStatement(accountId, '2026-02-28', 0n);
      const fine = await s.seedTransaction(accountId, '2026-02-01', 100n);
      const bad = await s.seedTransaction(accountId, date, 100n);

      await expectConflict(s.service.tick(s.owner, accountId, open.id, ticks([fine.id, bad.id])), ErrorCodes.TRANSACTION_NOT_ELIGIBLE);
      expect(s.repos.transactions.rows.every((row) => row.reconciliationId === null)).toBe(true);
    });

    it('rejects a row cleared by another statement', async () => {
      const finished = await s.seedStatement(accountId, '2026-01-31', 0n, true);
      const open = await s.seedStatement(accountId, '2026-02-28', 0n);
      const cleared = await s.seedTransaction(accountId, '2026-01-20', 300n, finished.id);

      await expectConflict(s.service.tick(s.owner, accountId, open.id, ticks([cleared.id])), ErrorCodes.TRANSACTION_NOT_ELIGIBLE);
    });

    it('answers 404 for the whole batch when an id is not on the account, in either array', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 0n);
      const other = (await s.seedAccount({ name: 'Other' })).id;
      const mine = await s.seedTransaction(accountId, '2026-02-01', 100n);
      const foreign = await s.seedTransaction(other, '2026-02-01', 100n);

      await expect(s.service.tick(s.owner, accountId, open.id, ticks([mine.id, foreign.id]))).rejects.toBeInstanceOf(NotFoundException);
      await expect(s.service.tick(s.owner, accountId, open.id, ticks([mine.id], [999_999]))).rejects.toBeInstanceOf(NotFoundException);
      expect(s.repos.transactions.rows.every((row) => row.reconciliationId === null)).toBe(true);
    });

    it('answers RECONCILIATION_FINISHED before TRANSACTION_NOT_ELIGIBLE, and ACCOUNT_ARCHIVED before both', async () => {
      const finished = await s.seedStatement(accountId, '2026-01-31', 0n, true);
      const late = await s.seedTransaction(accountId, '2026-03-01', 1n);
      const archived = (await s.seedAccount({ archivedAt: new Date() })).id;
      const archivedStatement = await s.seedStatement(archived, '2026-01-31', 0n, true);
      const archivedRow = await s.seedTransaction(archived, '2026-03-01', 1n);

      await expectConflict(s.service.tick(s.owner, accountId, finished.id, ticks([late.id])), ErrorCodes.RECONCILIATION_FINISHED);
      await expectConflict(s.service.tick(s.owner, archived, archivedStatement.id, ticks([archivedRow.id])), ErrorCodes.ACCOUNT_ARCHIVED);
    });

    it('rejects an empty or overlapping body before any database access', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 0n);

      await expect(s.service.tick(s.owner, 999, open.id, ticks([], []))).rejects.toBeInstanceOf(BadRequestException);
      await expect(s.service.tick(s.owner, 999, 999, ticks([1], [1]))).rejects.toBeInstanceOf(BadRequestException);
      expect(s.lockOrder).toEqual([]);
    });
  });

  describe('finish and undo', () => {
    it('finishes at difference zero, then undoes keeping the ticks', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 102_500n);
      await s.seedTransaction(accountId, '2026-01-10', 2_500n, open.id);

      const finished = await s.service.finish(s.owner, accountId, open.id);

      expect(finished).toMatchObject({ status: 'finished', difference: '0.00', ticked_sum: '25.00', cleared_balance: '1000.00', transaction_count: 1 });
      expect(finished.reconciled_at).toBeInstanceOf(Date);
      expect(s.lockOrder).toEqual(['Account', 'Reconciliation', 'Transaction']);

      const reopened = await s.service.undo(s.owner, accountId, open.id);

      expect(reopened).toMatchObject({ status: 'open', reconciled_at: null, ticked_sum: '25.00', cleared_balance: '1000.00', difference: '0.00' });
    });

    it('locks the ticked rows of the statement (account-scoped) before the balance check and the finish update', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 102_500n);
      const other = await s.seedAccount({ name: 'Sibling' });
      const otherOpen = await s.seedStatement(other.id, '2026-02-28', 0n);
      await s.seedTransaction(accountId, '2026-01-10', 2_500n, open.id);
      await s.seedTransaction(other.id, '2026-01-10', 1n, otherOpen.id);
      const calls: string[] = [];
      const lockTicked = jest.spyOn(s.query, 'lockTicked').mockImplementation(async () => {
        calls.push('lockTicked');
        return [];
      });
      jest.spyOn(s.query, 'markFinished').mockImplementation(async () => {
        calls.push('markFinished');
        return true;
      });

      await s.service.finish(s.owner, accountId, open.id);

      expect(lockTicked).toHaveBeenCalledWith(expect.anything(), accountId, open.id);
      expect(calls).toEqual(['lockTicked', 'markFinished']);
    });

    it('does not finish when the locked-rows read hits a deadlock or a lock wait timeout', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 0n);
      const timeout = new QueryFailedError('q', [], Object.assign(new Error('timeout'), { code: 'ER_LOCK_WAIT_TIMEOUT' }));
      jest.spyOn(s.query, 'lockTicked').mockRejectedValueOnce(timeout);

      await expectConflict(s.service.finish(s.owner, accountId, open.id), ErrorCodes.CONCURRENT_UPDATE);
      expect(s.repos.reconciliations.rows.find((row) => row.id === open.id)?.reconciledAt).toBeNull();
    });

    it('finishes a zero-row statement at the opening balance', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 100_000n);

      await expect(s.service.finish(s.owner, accountId, open.id)).resolves.toMatchObject({ status: 'finished', transaction_count: 0 });
    });

    it('refuses to finish at a non-zero difference, and a second finish', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 100_001n);
      const balanced = await s.seedStatement(await s.seedAccount({ name: 'B' }).then((a) => a.id), '2026-02-28', 100_000n);

      await expectConflict(s.service.finish(s.owner, accountId, open.id), ErrorCodes.RECONCILIATION_UNBALANCED);
      await s.service.finish(s.owner, balanced.accountId, balanced.id);
      await expectConflict(s.service.finish(s.owner, balanced.accountId, balanced.id), ErrorCodes.RECONCILIATION_FINISHED);
    });

    it('keeps full precision near the 10^13 bound', async () => {
      const big = (await s.seedAccount({ name: 'Big', openingBalance: 10n ** 13n - 1n })).id;
      const open = await s.seedStatement(big, '2026-02-28', 10n ** 13n);

      await expectConflict(s.service.finish(s.owner, big, open.id), ErrorCodes.RECONCILIATION_UNBALANCED);
      await s.seedTransaction(big, '2026-01-10', 1n, open.id);
      await expect(s.service.finish(s.owner, big, open.id)).resolves.toMatchObject({ status: 'finished', difference: '0.00' });
    });

    it('answers the undo errors in order: ACCOUNT_ARCHIVED, NOT_FINISHED, OPEN, NOT_LATEST', async () => {
      const first = await s.seedStatement(accountId, '2026-01-31', 100_000n, true);
      const second = await s.seedStatement(accountId, '2026-02-28', 100_000n, true);
      const open = await s.seedStatement(accountId, '2026-03-31', 100_000n);

      await expectConflict(s.service.undo(s.owner, accountId, open.id), ErrorCodes.RECONCILIATION_NOT_FINISHED);
      await expectConflict(s.service.undo(s.owner, accountId, second.id), ErrorCodes.RECONCILIATION_OPEN);
      await s.service.cancel(s.owner, accountId, open.id);
      await expectConflict(s.service.undo(s.owner, accountId, first.id), ErrorCodes.RECONCILIATION_NOT_LATEST);
      await expect(s.service.undo(s.owner, accountId, second.id)).resolves.toMatchObject({ status: 'open' });
    });

    it('answers ACCOUNT_ARCHIVED for undo before the state errors', async () => {
      const archived = (await s.seedAccount({ archivedAt: new Date() })).id;
      const finished = await s.seedStatement(archived, '2026-01-31', 0n, true);

      await expectConflict(s.service.undo(s.owner, archived, finished.id), ErrorCodes.ACCOUNT_ARCHIVED);
      await expectConflict(s.service.finish(s.owner, archived, finished.id), ErrorCodes.ACCOUNT_ARCHIVED);
    });

    it('maps a unique open_key violation on undo (a concurrent start) to RECONCILIATION_OPEN', async () => {
      const finished = await s.seedStatement(accountId, '2026-01-31', 100_000n, true);
      const duplicate = new QueryFailedError('q', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
      jest.spyOn(s.query, 'reopen').mockRejectedValueOnce(duplicate);

      await expectConflict(s.service.undo(s.owner, accountId, finished.id), ErrorCodes.RECONCILIATION_OPEN);
    });

    it('maps a deadlock on finish to CONCURRENT_UPDATE', async () => {
      const open = await s.seedStatement(accountId, '2026-02-28', 100_000n);
      const deadlock = new QueryFailedError('q', [], Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' }));
      jest.spyOn(s.query, 'markFinished').mockRejectedValueOnce(deadlock);

      await expectConflict(s.service.finish(s.owner, accountId, open.id), ErrorCodes.CONCURRENT_UPDATE);
    });
  });

  describe('list and get', () => {
    it('lists newest first with the open statement first, counts and undoable', async () => {
      const first = await s.seedStatement(accountId, '2026-01-31', 0n, true);
      const second = await s.seedStatement(accountId, '2026-02-28', 0n, true);
      await s.seedTransaction(accountId, '2026-02-01', 1n, second.id);
      await s.seedTransaction(accountId, '2026-02-02', 1n, second.id);

      const withoutOpen = await s.service.list(s.owner, accountId, 1);

      expect(withoutOpen.reconciliations.map((row) => [row.id, row.undoable, row.transaction_count])).toEqual([[second.id, true, 2], [first.id, false, 0]]);

      const open = await s.seedStatement(accountId, '2026-03-31', 0n);
      const withOpen = await s.service.list(s.owner, accountId, 1);

      expect(withOpen.reconciliations.map((row) => [row.id, row.status, row.undoable])).toEqual([
        [open.id, 'open', false],
        [second.id, 'finished', false],
        [first.id, 'finished', false],
      ]);
      expect(withOpen.pagination).toEqual({ page: 1, per_page: 50, total_pages: 1, total_count: 3 });
    });

    it('counts with one grouped query and pages 50 per page', async () => {
      for (let month = 0; month < 51; month++) {
        await s.seedStatement(accountId, new Date(Date.UTC(2020, month, 1)).toISOString().slice(0, 10), 0n, true);
      }

      ReconciliationQuery.countCalls = 0;
      const first = await s.service.list(s.owner, accountId, 1);
      const second = await s.service.list(s.owner, accountId, 2);

      expect([first.reconciliations.length, second.reconciliations.length, first.pagination.total_pages]).toEqual([50, 1, 2]);
      expect(ReconciliationQuery.countCalls).toBe(2);
    });

    it('gets a statement and answers 404 for a sibling account statement or an unknown account', async () => {
      const own = await s.seedStatement(accountId, '2026-02-28', 100_000n);
      const sibling = await s.seedAccount({ name: 'Sibling' });
      const foreign = await s.seedStatement(sibling.id, '2026-02-28', 0n);

      await expect(s.service.get(s.owner, accountId, own.id)).resolves.toMatchObject({ id: own.id, status: 'open', difference: '0.00' });
      await expect(s.service.get(s.owner, accountId, foreign.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(s.service.get(s.owner, 999, own.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(s.service.list(s.owner, 999, 1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
